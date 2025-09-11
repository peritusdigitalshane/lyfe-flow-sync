import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, RotateCcw, Clock, User, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface EmailDemo {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  timestamp: string;
  priorityScore: number;
  aiReason: string;
  hasAttachment?: boolean;
}

const sampleEmails: EmailDemo[] = [
  {
    id: '1',
    sender: 'CEO@company.com',
    subject: 'URGENT: Board meeting moved to 2 PM today',
    preview: 'The board meeting has been rescheduled due to an emergency...',
    timestamp: '2 min ago',
    priorityScore: 95,
    aiReason: 'High urgency keywords, CEO sender, time-sensitive meeting change',
    hasAttachment: false
  },
  {
    id: '2',
    sender: 'support@stripe.com',
    subject: 'Payment Failed - Action Required',
    preview: 'Your payment method was declined. Please update...',
    timestamp: '5 min ago',
    priorityScore: 88,
    aiReason: 'Payment issue, requires immediate action, from financial service',
  },
  {
    id: '3',
    sender: 'client@bigcorp.com',
    subject: 'Project deadline extension request',
    preview: 'Hi, we need to discuss extending the project deadline...',
    timestamp: '15 min ago',
    priorityScore: 72,
    aiReason: 'Client communication, project-related, deadline discussion',
  },
  {
    id: '4',
    sender: 'team@company.com',
    subject: 'Weekly team standup notes',
    preview: 'Here are the notes from today\'s standup meeting...',
    timestamp: '1 hour ago',
    priorityScore: 45,
    aiReason: 'Internal team communication, informational, not time-critical',
  },
  {
    id: '5',
    sender: 'newsletter@techcrunch.com',
    subject: 'Latest tech news and updates',
    preview: 'Check out the biggest tech stories from this week...',
    timestamp: '2 hours ago',
    priorityScore: 15,
    aiReason: 'Newsletter content, low priority, can be read later',
  }
];

const getPriorityColor = (score: number) => {
  if (score >= 85) return 'bg-red-500';
  if (score >= 70) return 'bg-orange-500';
  if (score >= 50) return 'bg-yellow-500';
  if (score >= 30) return 'bg-blue-500';
  return 'bg-gray-500';
};

const getPriorityLabel = (score: number) => {
  if (score >= 85) return 'URGENT';
  if (score >= 70) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  if (score >= 30) return 'LOW';
  return 'MINIMAL';
};

const getPriorityBadgeVariant = (score: number): "default" | "secondary" | "destructive" | "outline" => {
  if (score >= 85) return 'destructive';
  if (score >= 70) return 'default';
  if (score >= 50) return 'secondary';
  return 'outline';
};

export function PriorityScoreDemo() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showScores, setShowScores] = useState(false);
  const { toast } = useToast();

  const startDemo = () => {
    setIsPlaying(true);
    setCurrentStep(0);
    setShowScores(false);
    
    // Animate through the demo steps
    const steps = [
      { delay: 1000, action: () => setShowScores(true) },
      { delay: 2000, action: () => setCurrentStep(1) },
      { delay: 3000, action: () => setCurrentStep(2) },
      { delay: 4000, action: () => setCurrentStep(3) },
      { delay: 5000, action: () => setCurrentStep(4) },
      { delay: 6000, action: () => {
        setIsPlaying(false);
        toast({
          title: "Demo Complete!",
          description: "AI has automatically prioritized all emails based on content, sender, and urgency.",
        });
      }}
    ];

    steps.forEach(({ delay, action }) => {
      setTimeout(action, delay);
    });
  };

  const resetDemo = () => {
    setIsPlaying(false);
    setCurrentStep(0);
    setShowScores(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Smart Priority Scoring Demo
              </CardTitle>
              <CardDescription>
                Watch AI automatically prioritize emails based on content, sender importance, and urgency
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={startDemo}
                disabled={isPlaying}
                className="flex items-center gap-2"
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-4 w-4" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Watch Demo
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={resetDemo}
                disabled={isPlaying}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sampleEmails.map((email, index) => (
              <Card 
                key={email.id}
                className={`transition-all duration-500 ${
                  currentStep >= index ? 'ring-2 ring-primary' : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{email.sender}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span className="text-xs">{email.timestamp}</span>
                        </div>
                        {showScores && (
                          <div className="flex items-center gap-2 ml-auto">
                            <div className={`w-3 h-3 rounded-full ${getPriorityColor(email.priorityScore)}`}></div>
                            <Badge variant={getPriorityBadgeVariant(email.priorityScore)}>
                              {getPriorityLabel(email.priorityScore)} - {email.priorityScore}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <h4 className="font-medium text-sm mb-1 truncate">{email.subject}</h4>
                      <p className="text-xs text-muted-foreground truncate">{email.preview}</p>
                      {showScores && currentStep >= index && (
                        <div className="mt-3 p-2 bg-muted/50 rounded text-xs">
                          <span className="font-medium text-primary">AI Analysis:</span> {email.aiReason}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {showScores && (
            <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <h4 className="font-semibold text-sm mb-2">Priority Scoring Results:</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>URGENT (85-100)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span>HIGH (70-84)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span>MEDIUM (50-69)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span>LOW (30-49)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                  <span>MINIMAL (0-29)</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}