import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Star, Mail, User, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmailListItemProps {
  email: {
    id: string;
    subject: string;
    sender_email: string;
    sender_name?: string;
    received_at: string;
    is_read?: boolean;
    is_vip?: boolean;
    body_preview?: string;
    has_attachments?: boolean;
  };
  onClick?: (email: any) => void;
  className?: string;
}

export function EmailListItem({ email, onClick, className }: EmailListItemProps) {
  const isVip = email.is_vip;
  
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        isVip && "border-yellow-300 bg-yellow-50/50 dark:bg-yellow-950/20 dark:border-yellow-700",
        !email.is_read && "bg-blue-50/30 dark:bg-blue-950/20",
        className
      )}
      onClick={() => onClick?.(email)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* VIP Star */}
            {isVip && (
              <Star className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="currentColor" />
            )}
            
            {/* Email Icon */}
            <Mail className={cn(
              "h-4 w-4 flex-shrink-0 mt-1",
              !email.is_read ? "text-blue-600" : "text-muted-foreground"
            )} />
            
            {/* Email Content */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className={cn(
                    "font-medium truncate",
                    !email.is_read && "font-semibold",
                    isVip && "text-yellow-800 dark:text-yellow-200"
                  )}>
                    {email.sender_name || email.sender_email}
                  </span>
                  {isVip && (
                    <Badge variant="secondary" className="text-xs bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                      VIP
                    </Badge>
                  )}
                  {!email.is_read && (
                    <Badge variant="default" className="text-xs">
                      New
                    </Badge>
                  )}
                </div>
                
                {/* Timestamp */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                  <Calendar className="h-3 w-3" />
                  <span>{new Date(email.received_at).toLocaleDateString()}</span>
                </div>
              </div>
              
              {/* Subject */}
              <div className={cn(
                "text-sm mb-1 truncate",
                !email.is_read && "font-semibold",
                isVip && "text-yellow-900 dark:text-yellow-100"
              )}>
                {email.subject || "(No Subject)"}
              </div>
              
              {/* Preview */}
              {email.body_preview && (
                <div className="text-xs text-muted-foreground truncate">
                  {email.body_preview}
                </div>
              )}
              
              {/* Metadata */}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                {email.sender_name && (
                  <span className="truncate">{email.sender_email}</span>
                )}
                {email.has_attachments && (
                  <Badge variant="outline" className="text-xs">
                    📎 Attachments
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default EmailListItem;