import React from 'react';
import { ImprovedNavigation } from '@/components/ImprovedNavigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { VipEmailManagement } from '@/components/VipEmailManagement';
import { VipEmailPreview } from '@/components/VipEmailPreview';

export default function VipManagement() {
  return (
    <div className="min-h-screen bg-background">
      <ImprovedNavigation />
      <div className="container mx-auto px-4 py-8">
        <Breadcrumbs />
        
        <div className="mt-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">VIP Email Management</h1>
            <p className="text-muted-foreground mt-2">
              Manage important email addresses that will be highlighted and prioritized across all your mailboxes.
            </p>
          </div>

          <div className="grid gap-6">
            {/* VIP Management */}
            <VipEmailManagement />
            
            {/* VIP Preview */}
            <VipEmailPreview />
          </div>
        </div>
      </div>
    </div>
  );
}