import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Brain, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ClassificationResult {
  category: string;
  confidence: number;
  reasoning: string;
}

export default function AIClassification() {
  const [loading, setLoading] = useState(false);
  const [emailData, setEmailData] = useState({
    subject: '',
    body: '',
    sender_email: '',
    sender_name: ''
  });
  const [result, setResult] = useState<ClassificationResult | null>(null);

  const handleClassify = async () => {
    if (!emailData.subject || !emailData.body || !emailData.sender_email) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-email-classifier', {
        body: { emailData }
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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/settings">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Button>
        </Link>
      </div>

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
            <CardTitle>Available Categories</CardTitle>
            <CardDescription>
              Categories used by the AI classification system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { name: "Personal", description: "Emails from friends or family members" },
                { name: "Junk&Spam", description: "Unsolicited email or spam" },
                { name: "Promotional", description: "Cold call emails trying to sell something" },
                { name: "Social", description: "Emails from social media sites" },
                { name: "Misc", description: "Anything not assigned to other categories" },
                { name: "Alerts", description: "Emails alerting to items that need action" },
                { name: "Invoices and quotes", description: "All invoices and quotes" },
                { name: "BCC/Bidabah", description: "Emails from specific organizations" }
              ].map((category) => (
                <div key={category.name} className="border rounded-md p-3">
                  <div className="font-medium">{category.name}</div>
                  <div className="text-sm text-muted-foreground">{category.description}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}