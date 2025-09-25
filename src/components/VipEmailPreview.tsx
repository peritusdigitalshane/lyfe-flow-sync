import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, Mail } from 'lucide-react';
import EmailListItem from './EmailListItem';

// Demo component to showcase VIP email highlighting
export function VipEmailPreview() {
  // Sample email data to demonstrate VIP functionality
  const sampleEmails = [
    {
      id: '1',
      subject: 'Urgent: Board Meeting Tomorrow',
      sender_email: 'ceo@company.com',
      sender_name: 'John Smith (CEO)',
      received_at: new Date().toISOString(),
      is_read: false,
      is_vip: true,
      body_preview: 'Please review the quarterly reports before tomorrow\'s board meeting. The presentation needs to be ready by 9 AM.',
      has_attachments: true
    },
    {
      id: '2',
      subject: 'Weekly Newsletter',
      sender_email: 'newsletter@example.com',
      sender_name: 'Marketing Team',
      received_at: new Date(Date.now() - 3600000).toISOString(),
      is_read: true,
      is_vip: false,
      body_preview: 'Check out this week\'s product updates and company news.',
      has_attachments: false
    },
    {
      id: '3',
      subject: 'Contract Review Required',
      sender_email: 'legal@bigclient.com',
      sender_name: 'Sarah Johnson (Legal)',
      received_at: new Date(Date.now() - 7200000).toISOString(),
      is_read: false,
      is_vip: true,
      body_preview: 'The new service agreement requires your immediate attention. Please review sections 4.2 and 7.1.',
      has_attachments: true
    },
    {
      id: '4',
      subject: 'System Maintenance Notification',
      sender_email: 'noreply@system.com',
      sender_name: 'System Administrator',
      received_at: new Date(Date.now() - 10800000).toISOString(),
      is_read: true,
      is_vip: false,
      body_preview: 'Scheduled maintenance will occur tonight from 2 AM to 4 AM EST.',
      has_attachments: false
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500" />
          VIP Email Preview
        </CardTitle>
        <CardDescription>
          See how VIP emails will be highlighted in your email lists. VIP emails stand out with golden styling and star icons.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {sampleEmails.map((email) => (
            <EmailListItem 
              key={email.id} 
              email={email}
              onClick={() => {}}
            />
          ))}
        </div>
        
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">VIP Email Features:</span>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <Star className="h-3 w-3 text-yellow-500 inline mr-1" /> Golden star icon for instant recognition</li>
            <li>• Enhanced border and background highlighting</li>
            <li>• <Badge variant="secondary" className="text-xs bg-yellow-200 text-yellow-800">VIP</Badge> Special VIP badge</li>
            <li>• Priority placement in email lists</li>
            <li>• Never miss important communications</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}