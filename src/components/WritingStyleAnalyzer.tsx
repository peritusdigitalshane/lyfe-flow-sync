import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Brain, User, FileText, Clock } from "lucide-react";

interface WritingStyle {
  tone: 'formal' | 'casual' | 'friendly' | 'professional';
  avgLength: number;
  commonPhrases: string[];
  formalityLevel: number;
  usesBulletPoints: boolean;
  usesEmojis: boolean;
  closingStyle: string;
}

interface WritingProfile {
  id: string;
  writing_style: WritingStyle;
  signature?: string;
  last_analyzed_at: string;
  emails_analyzed: number;
}

export function WritingStyleAnalyzer() {
  const [profile, setProfile] = useState<WritingProfile | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadWritingProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_writing_profiles')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setProfile({
          ...data,
          writing_style: data.writing_style as unknown as WritingStyle
        } as WritingProfile);
      }
    } catch (error) {
      console.error('Error loading writing profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeWritingStyle = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-writing-style');

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Analysis Complete",
          description: `Analyzed ${data.emailsAnalyzed} emails to learn your writing style.`,
        });
        await loadWritingProfile(); // Refresh the profile
      } else {
        throw new Error(data?.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Error analyzing writing style:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze writing style. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Load profile on component mount
  useState(() => {
    loadWritingProfile();
  });

  const getFormalityDescription = (level: number) => {
    if (level >= 8) return "Very formal";
    if (level >= 6) return "Professional";
    if (level >= 4) return "Balanced";
    if (level >= 2) return "Casual";
    return "Very casual";
  };

  const getToneColor = (tone: string) => {
    switch (tone) {
      case 'formal': return 'bg-blue-100 text-blue-800';
      case 'professional': return 'bg-purple-100 text-purple-800';
      case 'friendly': return 'bg-green-100 text-green-800';
      case 'casual': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Brain className="mr-2 h-5 w-5" />
              Writing Style Analysis
            </CardTitle>
            <CardDescription>
              AI learns from your sent emails to generate replies that match your writing style
            </CardDescription>
          </div>
          <Button 
            onClick={analyzeWritingStyle} 
            disabled={isAnalyzing}
            variant="outline"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                {profile ? 'Re-analyze' : 'Analyze Style'}
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!profile ? (
          <div className="text-center py-8 space-y-4">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No writing style analysis yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Click "Analyze Style" to have AI learn from your sent emails and improve reply generation.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Analysis Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg border">
                <User className="h-5 w-5 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">Tone</p>
                <Badge className={getToneColor(profile.writing_style.tone)}>
                  {profile.writing_style.tone}
                </Badge>
              </div>
              <div className="text-center p-3 rounded-lg border">
                <FileText className="h-5 w-5 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">Formality</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {getFormalityDescription(profile.writing_style.formalityLevel)}
                </p>
              </div>
              <div className="text-center p-3 rounded-lg border">
                <Clock className="h-5 w-5 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">Avg Length</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {profile.writing_style.avgLength} words
                </p>
              </div>
              <div className="text-center p-3 rounded-lg border">
                <Brain className="h-5 w-5 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">Emails</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {profile.emails_analyzed} analyzed
                </p>
              </div>
            </div>

            {/* Writing Patterns */}
            <div className="space-y-4">
              <h4 className="font-medium">Writing Patterns</h4>
              
              <div className="grid gap-4">
                <div>
                  <p className="text-sm font-medium mb-2">Common Phrases</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.writing_style.commonPhrases?.map((phrase, index) => (
                      <Badge key={index} variant="secondary">
                        "{phrase}"
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Writing Style Features</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.writing_style.usesBulletPoints && (
                      <Badge variant="outline">Uses bullet points</Badge>
                    )}
                    {profile.writing_style.usesEmojis && (
                      <Badge variant="outline">Uses emojis</Badge>
                    )}
                    <Badge variant="outline">
                      Closes with "{profile.writing_style.closingStyle}"
                    </Badge>
                  </div>
                </div>

                {profile.signature && (
                  <div>
                    <p className="text-sm font-medium mb-2">Email Signature</p>
                    <div className="p-3 bg-muted rounded-lg">
                      <pre className="text-sm whitespace-pre-wrap font-mono">
                        {profile.signature}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Last Analysis Info */}
            <div className="text-xs text-muted-foreground pt-4 border-t">
              Last analyzed: {new Date(profile.last_analyzed_at).toLocaleString()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}