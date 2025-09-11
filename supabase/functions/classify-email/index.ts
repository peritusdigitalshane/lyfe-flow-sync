import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailData {
  id: string;
  subject: string;
  sender: string;
  content: string;
  mailboxId: string;
  tenantId: string;
}

interface ClassificationRule {
  id: string;
  category_id: string;
  rule_type: 'sender' | 'subject' | 'content' | 'domain' | 'ai';
  rule_value: string;
  priority: number;
}

interface EmailCategory {
  id: string;
  name: string;
  priority: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { email }: { email: EmailData } = await req.json();
    
    console.log('Processing email classification for:', email.id);

    // Get all active classification rules for this tenant and mailbox
    const { data: rules, error: rulesError } = await supabase
      .from('email_classification_rules')
      .select(`
        *,
        email_categories(id, name, priority)
      `)
      .eq('tenant_id', email.tenantId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (rulesError) {
      console.error('Error fetching rules:', rulesError);
      throw rulesError;
    }

    console.log(`Found ${rules?.length || 0} active rules`);

    // Get available categories for this mailbox
    const { data: availableCategories, error: categoriesError } = await supabase
      .from('email_categories')
      .select('id, name, priority')
      .eq('tenant_id', email.tenantId)
      .eq('is_active', true)
      .or(`mailbox_id.eq.${email.mailboxId},mailbox_id.is.null`)
      .order('priority', { ascending: false });

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      throw categoriesError;
    }

    if (!availableCategories || availableCategories.length === 0) {
      console.log('No categories found for this mailbox');
      return new Response(JSON.stringify({
        success: false,
        error: 'No categories configured for this mailbox',
        message: 'Please create email categories for this mailbox before classification can work'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    console.log(`Found ${availableCategories.length} available categories for mailbox`);

    // Process rules and find matches
    let bestMatch: {
      category_id: string;
      rule_id: string;
      confidence: number;
      method: string;
    } | null = null;

    for (const rule of rules || []) {
      // Check if the rule's category is available for this mailbox
      const categoryAvailable = availableCategories.find(cat => cat.id === rule.category_id);
      if (!categoryAvailable) {
        console.log(`Skipping rule ${rule.id} - category not available for this mailbox`);
        continue;
      }

      const match = checkRuleMatch(email, rule);
      if (match && (!bestMatch || rule.priority > bestMatch.confidence)) {
        bestMatch = {
          category_id: rule.category_id,
          rule_id: rule.id,
          confidence: rule.priority / 100, // Convert priority to confidence score
          method: 'rule'
        };
      }
    }

    // If no rule match found, use the highest priority category for this mailbox
    if (!bestMatch && availableCategories.length > 0) {
      console.log('No rule matches found, using highest priority category for this mailbox');
      
      const defaultCategory = availableCategories[0]; // Already ordered by priority desc
      bestMatch = {
        category_id: defaultCategory.id,
        rule_id: '',
        confidence: 0.3,
        method: 'default'
      };
    }

    // Store the classification result
    if (bestMatch) {
      const { error: insertError } = await supabase
        .from('email_classifications')
        .insert({
          tenant_id: email.tenantId,
          mailbox_id: email.mailboxId,
          category_id: bestMatch.category_id,
          email_id: email.id,
          confidence_score: bestMatch.confidence,
          classification_method: bestMatch.method,
          rule_id: bestMatch.rule_id || null,
          metadata: {
            sender: email.sender,
            subject: email.subject,
            processed_at: new Date().toISOString()
          }
        });

      if (insertError) {
        console.error('Error storing classification:', insertError);
        throw insertError;
      }

      console.log(`Email classified successfully: ${email.id} -> category ${bestMatch.category_id}`);
    }

    return new Response(JSON.stringify({
      success: true,
      classification: bestMatch,
      message: bestMatch ? 'Email classified successfully' : 'No classification rules matched'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in classify-email function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
};

function checkRuleMatch(email: EmailData, rule: ClassificationRule): boolean {
  const ruleValue = rule.rule_value.toLowerCase();
  
  switch (rule.rule_type) {
    case 'sender':
      return email.sender.toLowerCase().includes(ruleValue);
    
    case 'domain':
      const domain = email.sender.split('@')[1]?.toLowerCase();
      return domain === ruleValue;
    
    case 'subject':
      return email.subject.toLowerCase().includes(ruleValue);
    
    case 'content':
      return email.content.toLowerCase().includes(ruleValue);
    
    default:
      return false;
  }
}

serve(handler);