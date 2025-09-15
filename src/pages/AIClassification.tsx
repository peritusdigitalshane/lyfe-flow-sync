import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Brain, Upload, Mail } from 'lucide-react';
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
  const [dragActive, setDragActive] = useState(false);

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

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const emailText = e.dataTransfer.getData('text/plain');
    const emailHtml = e.dataTransfer.getData('text/html');

    try {
      // Handle dropped files (like .msg files from Outlook)
      if (files.length > 0) {
        const file = files[0];
        if (file.name.endsWith('.msg') || file.name.endsWith('.eml')) {
          // For MSG/EML files, we'd need a parser, but for now show guidance
          toast.error('MSG/EML file parsing not yet supported. Please copy and paste email content or drag the email content directly.');
          return;
        }
        
        // Handle text files
        if (file.type === 'text/plain' || file.type === 'text/html') {
          const content = await file.text();
          parseEmailContent(content);
          return;
        }
      }

      // Handle text content dropped directly from Outlook
      if (emailText || emailHtml) {
        parseEmailContent(emailHtml || emailText);
        return;
      }

      toast.error('No supported email content found. Please drag an email directly from Outlook or paste the content.');
    } catch (error) {
      console.error('Error processing dropped content:', error);
      toast.error('Failed to process dropped email');
    }
  };

  const parseEmailContent = (content: string) => {
    try {
      // Basic email parsing - this handles common email formats
      let subject = '';
      let body = '';
      let senderEmail = '';
      let senderName = '';

      // Try to extract from HTML content first
      if (content.includes('<')) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        
        // Remove script and style elements
        const scripts = doc.querySelectorAll('script, style');
        scripts.forEach(el => el.remove());
        
        body = doc.body?.innerText || doc.documentElement?.innerText || content;
      } else {
        body = content;
      }

      // Look for common email patterns in the text
      const lines = body.split('\n');
      
      for (let i = 0; i < Math.min(lines.length, 10); i++) {
        const line = lines[i].trim();
        
        // Look for subject
        if (line.toLowerCase().startsWith('subject:')) {
          subject = line.substring(8).trim();
        }
        
        // Look for from field
        if (line.toLowerCase().startsWith('from:')) {
          const fromLine = line.substring(5).trim();
          const emailMatch = fromLine.match(/([^<]+)<([^>]+)>/);
          if (emailMatch) {
            senderName = emailMatch[1].trim();
            senderEmail = emailMatch[2].trim();
          } else {
            // Just an email address
            const emailOnly = fromLine.match(/[\w\.-]+@[\w\.-]+\.\w+/);
            if (emailOnly) {
              senderEmail = emailOnly[0];
            }
          }
        }
      }

      // If we found email headers, remove them from body
      if (subject || senderEmail) {
        const headerLines = [];
        let bodyStartIndex = 0;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim().toLowerCase();
          if (line.startsWith('subject:') || line.startsWith('from:') || 
              line.startsWith('to:') || line.startsWith('date:') ||
              line.startsWith('sent:') || line.startsWith('cc:')) {
            bodyStartIndex = i + 1;
          } else if (line === '') {
            bodyStartIndex = i + 1;
            break;
          } else if (bodyStartIndex === 0) {
            break;
          }
        }
        
        if (bodyStartIndex > 0) {
          body = lines.slice(bodyStartIndex).join('\n').trim();
        }
      }

      // Update form with extracted data
      setEmailData({
        subject: subject || emailData.subject,
        body: body || emailData.body,
        sender_email: senderEmail || emailData.sender_email,
        sender_name: senderName || emailData.sender_name
      });

      toast.success('Email content extracted successfully!');
    } catch (error) {
      console.error('Error parsing email content:', error);
      toast.error('Failed to parse email content. Please fill fields manually.');
    }
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
        {/* Drag and Drop Email Zone */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Drag & Drop Email from Outlook
            </CardTitle>
            <CardDescription>
              Drag an email directly from Outlook to automatically extract its content for classification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? 'border-primary bg-primary/5 text-primary' 
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className={`mx-auto h-12 w-12 mb-4 ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="space-y-2">
                <p className={`text-lg font-medium ${dragActive ? 'text-primary' : 'text-foreground'}`}>
                  {dragActive ? 'Drop email here' : 'Drag email from Outlook'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Select an email in Outlook and drag it here to automatically extract the subject, sender, and content
                </p>
                <div className="text-xs text-muted-foreground mt-4 space-y-1">
                  <p>• Drag directly from Outlook email list</p>
                  <p>• Copy and paste email content as alternative</p>
                  <p>• Supports plain text and HTML email formats</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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