import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Brain } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ImprovedNavigation } from '@/components/ImprovedNavigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';

interface ClassificationResult {
  category: string;
  confidence: number;
  reasoning: string;
}

interface EmailCategory {
  id: string;
  name: string;
  description: string | null;
  color: string;
  priority: number;
  is_active: boolean;
}

export default function AIClassification() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [userCategories, setUserCategories] = useState<EmailCategory[]>([]);
  const [emailData, setEmailData] = useState({
    subject: '',
    body: '',
    sender_email: '',
    sender_name: ''
  });
  const [result, setResult] = useState<ClassificationResult | null>(null);

  useEffect(() => {
    if (user) {
      loadUserCategories();
    }
  }, [user]);

  const loadUserCategories = async () => {
    try {
      setCategoriesLoading(true);
      const { data, error } = await supabase
        .from('email_categories')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (error) throw error;
      setUserCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Failed to load your categories');
    } finally {
      setCategoriesLoading(false);
    }
  };

  const handleClassify = async () => {
    if (!emailData.subject || !emailData.body || !emailData.sender_email) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-email-classifier', {
        body: { 
          emailData: {
            ...emailData,
            user_id: user.id
          }
        }
      });

      if (error) {
        console.error('Classification error:', error);
        toast.error('Failed to classify email');
        return;
      }

      if (data.error) {
        console.error('AI classifier error:', data.error);
        toast.error(data.error);
        return;
      }

      setResult(data.classification);
      toast.success('Email classified successfully!');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to classify email');
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-background">
      <ImprovedNavigation />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Breadcrumbs />
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" />
            AI Email Classification Testing
          </h1>
          <p className="text-muted-foreground">
            Test the AI-powered email classification system using OpenAI
          </p>
        </div>

      <div className="grid gap-6">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle>Email Details</CardTitle>
            <CardDescription>
              Enter email information to test AI classification
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={emailData.subject}
                  onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                  placeholder="Enter email subject..."
                />
              </div>
              <div>
                <Label htmlFor="sender_email">Sender Email *</Label>
                <Input
                  id="sender_email"
                  type="email"
                  value={emailData.sender_email}
                  onChange={(e) => setEmailData({ ...emailData, sender_email: e.target.value })}
                  placeholder="sender@example.com"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="sender_name">Sender Name</Label>
              <Input
                id="sender_name"
                value={emailData.sender_name}
                onChange={(e) => setEmailData({ ...emailData, sender_name: e.target.value })}
                placeholder="Sender Name (optional)"
              />
            </div>

            <div>
              <Label htmlFor="body">Email Body *</Label>
              <Textarea
                id="body"
                value={emailData.body}
                onChange={(e) => setEmailData({ ...emailData, body: e.target.value })}
                placeholder="Enter email body content..."
                rows={6}
              />
            </div>

            <Button 
              onClick={handleClassify}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Classifying...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  Classify Email
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Classification Result</CardTitle>
              <CardDescription>
                AI-powered email category assignment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div>
                    <Label>Category</Label>
                    <div className="text-lg font-semibold">{result.category}</div>
                  </div>
                  <div>
                    <Label>Confidence</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-2">
                        <div 
                          className={`w-2 h-2 rounded-full ${getConfidenceColor(result.confidence)}`}
                        />
                        {Math.round(result.confidence * 100)}%
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label>AI Reasoning</Label>
                  <div className="bg-muted p-3 rounded-md mt-1">
                    {result.reasoning}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Available Categories */}
        <Card>
          <CardHeader>
            <CardTitle>Your Categories</CardTitle>
            <CardDescription>
              Categories configured for your account that the AI will use for classification
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categoriesLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : userCategories.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No categories configured yet.</p>
                <Link to="/email-categories">
                  <Button className="mt-2">Configure Categories</Button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {userCategories.map((category) => (
                  <div key={category.id} className="border rounded-md p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: category.color }}
                      />
                      <div className="font-medium">{category.name}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {category.description || 'No description provided'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </main>
    </div>
  );
}