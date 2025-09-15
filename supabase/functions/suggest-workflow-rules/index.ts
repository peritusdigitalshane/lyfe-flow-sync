import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailPattern {
  sender_domain: string;
  sender_email: string;
  subject_patterns: string[];
  frequency: number;
  latest_email: string;
}

interface SuggestedRule {
  name: string;
  description: string;
  condition_text: string;
  suggested_action: {
    type: string;
    category_name: string;
    category_color: string;
  };
  confidence: number;
  email_examples: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { 
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    console.log('Starting workflow rule suggestion process...');

    // Get user's tenant_id
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('User profile not found');
    }

    // Get recent emails for analysis (last 100)
    const { data: emails, error: emailsError } = await supabaseClient
      .from('emails')
      .select('id, subject, sender_email, sender_name, received_at, body_preview')
      .eq('tenant_id', profile.tenant_id)
      .order('received_at', { ascending: false })
      .limit(100);

    if (emailsError) {
      console.error('Error fetching emails:', emailsError);
      throw emailsError;
    }

    console.log(`Analyzing ${emails?.length || 0} emails for patterns...`);

    // Get existing workflow rules to avoid duplicates
    const { data: existingRules } = await supabaseClient
      .from('workflow_rules')
      .select('conditions, name')
      .eq('tenant_id', profile.tenant_id);

    // Analyze email patterns
    const patterns = analyzeEmailPatterns(emails || []);
    console.log(`Found ${patterns.length} email patterns`);

    // Generate AI-powered suggestions
    const suggestions = await generateSuggestions(patterns, existingRules || []);
    
    console.log(`Generated ${suggestions.length} rule suggestions`);

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in suggest-workflow-rules function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      suggestions: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function analyzeEmailPatterns(emails: any[]): EmailPattern[] {
  const senderMap = new Map<string, EmailPattern>();
  
  emails.forEach(email => {
    const senderEmail = email.sender_email?.toLowerCase() || '';
    const senderDomain = senderEmail.split('@')[1] || '';
    
    if (!senderMap.has(senderEmail)) {
      senderMap.set(senderEmail, {
        sender_domain: senderDomain,
        sender_email: senderEmail,
        subject_patterns: [],
        frequency: 0,
        latest_email: email.subject || ''
      });
    }
    
    const pattern = senderMap.get(senderEmail)!;
    pattern.frequency += 1;
    pattern.subject_patterns.push(email.subject || '');
    
    if (new Date(email.received_at) > new Date(pattern.latest_email)) {
      pattern.latest_email = email.subject || '';
    }
  });
  
  // Return patterns with frequency > 2 (multiple emails from same sender)
  return Array.from(senderMap.values())
    .filter(pattern => pattern.frequency > 2)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10); // Top 10 patterns
}

function generateSuggestions(patterns: EmailPattern[], existingRules: any[]): SuggestedRule[] {
  const suggestions: SuggestedRule[] = [];
  
  // Get existing conditions to avoid duplicates
  const existingConditions = existingRules.flatMap(rule => 
    Array.isArray(rule.conditions) ? rule.conditions.map((c: any) => c.value?.toLowerCase()) : []
  ).filter(Boolean);
  
  patterns.forEach(pattern => {
    const suggestions_for_pattern = generateSuggestionsForPattern(pattern, existingConditions);
    suggestions.push(...suggestions_for_pattern);
  });
  
  return suggestions.slice(0, 5); // Return top 5 suggestions
}

function generateSuggestionsForPattern(pattern: EmailPattern, existingConditions: string[]): SuggestedRule[] {
  const suggestions: SuggestedRule[] = [];
  const domain = pattern.sender_domain;
  const senderEmail = pattern.sender_email;
  
  // Check if we already have rules for this sender/domain
  const domainExists = existingConditions.some(cond => 
    cond.includes(domain.toLowerCase()) || cond.includes(senderEmail.toLowerCase())
  );
  
  if (domainExists) {
    return []; // Skip if we already have rules for this pattern
  }
  
  // Determine rule type based on domain and content patterns
  if (isPromotionalDomain(domain) || hasPromotionalKeywords(pattern.subject_patterns)) {
    suggestions.push({
      name: `Auto-categorize ${domain} emails`,
      description: `Automatically categorize emails from ${domain} as promotional content`,
      condition_text: `Any email from ${domain} domain`,
      suggested_action: {
        type: 'categorise',
        category_name: 'Promotional',
        category_color: '#eab308'
      },
      confidence: 0.85,
      email_examples: pattern.subject_patterns.slice(0, 3)
    });
  } else if (isNotificationDomain(domain) || hasAlertKeywords(pattern.subject_patterns)) {
    suggestions.push({
      name: `Auto-categorize ${domain} notifications`,
      description: `Automatically categorize notifications from ${domain}`,
      condition_text: `Any notification or alert email from ${domain}`,
      suggested_action: {
        type: 'categorise',
        category_name: 'Alerts',
        category_color: '#3b82f6'
      },
      confidence: 0.80,
      email_examples: pattern.subject_patterns.slice(0, 3)
    });
  } else if (isSocialDomain(domain)) {
    suggestions.push({
      name: `Auto-categorize ${domain} social updates`,
      description: `Automatically categorize social media updates from ${domain}`,
      condition_text: `Any email from social media platform ${domain}`,
      suggested_action: {
        type: 'categorise',
        category_name: 'Social',
        category_color: '#06b6d4'
      },
      confidence: 0.90,
      email_examples: pattern.subject_patterns.slice(0, 3)
    });
  } else if (pattern.frequency > 10) {
    // High frequency sender - suggest categorization
    suggestions.push({
      name: `Auto-categorize frequent sender ${senderEmail}`,
      description: `Automatically categorize emails from this frequent sender (${pattern.frequency} emails)`,
      condition_text: `Any email from ${senderEmail}`,
      suggested_action: {
        type: 'categorise',
        category_name: 'Frequent Senders',
        category_color: '#8b5cf6'
      },
      confidence: 0.75,
      email_examples: pattern.subject_patterns.slice(0, 3)
    });
  }
  
  return suggestions;
}

function isPromotionalDomain(domain: string): boolean {
  const promotionalKeywords = ['shop', 'store', 'deal', 'sale', 'promo', 'marketing', 'newsletter', 'retail'];
  return promotionalKeywords.some(keyword => domain.toLowerCase().includes(keyword));
}

function hasPromotionalKeywords(subjects: string[]): boolean {
  const promoKeywords = ['sale', 'deal', 'offer', 'discount', 'promo', 'special', 'limited time', 'save'];
  return subjects.some(subject => 
    promoKeywords.some(keyword => subject.toLowerCase().includes(keyword))
  );
}

function isNotificationDomain(domain: string): boolean {
  const notificationKeywords = ['notification', 'alert', 'service', 'system', 'admin', 'support'];
  return notificationKeywords.some(keyword => domain.toLowerCase().includes(keyword));
}

function hasAlertKeywords(subjects: string[]): boolean {
  const alertKeywords = ['alert', 'notification', 'update', 'reminder', 'notice', 'urgent', 'action required'];
  return subjects.some(subject => 
    alertKeywords.some(keyword => subject.toLowerCase().includes(keyword))
  );
}

function isSocialDomain(domain: string): boolean {
  const socialDomains = ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok', 'snapchat'];
  return socialDomains.some(social => domain.toLowerCase().includes(social));
}