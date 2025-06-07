import { useQuery } from "@tanstack/react-query";
import StatsCard from "@/components/dashboard/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Users, MessageSquare, Send, TrendingUp, Plus } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import type { DashboardStats } from "@shared/api-types";

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome back! Here's an overview of your messaging platform.
            </p>
          </div>
          <Button asChild className="flex items-center space-x-2">
            <Link href="/campaigns">
              <Plus className="w-4 h-4" />
              <span>Create Campaign</span>
            </Link>
          </Button>
        </div>
      </header>

      {/* Dashboard Content */}
      <div className="p-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Contacts"
            value={stats?.totalContacts || 0}
            change={stats?.contactsChange ?? 0}
            changeLabel="from last month"
            icon={Users}
            iconColor="text-primary"
            iconBgColor="bg-blue-50"
          />
          <StatsCard
            title="Messages Sent"
            value={stats?.messagesSent || 0}
            change={stats?.messagesChange ?? 0}
            changeLabel="from last week"
            icon={MessageSquare}
            iconColor="text-green-600"
            iconBgColor="bg-green-50"
          />
          <StatsCard
            title="Campaigns"
            value={stats?.activeCampaigns || 0}
            change={stats?.campaignsChange ?? 0}
            changeLabel="active campaigns"
            icon={Send}
            iconColor="text-purple-600"
            iconBgColor="bg-purple-50"
          />
          <StatsCard
            title="Delivery Rate"
            value={stats?.deliveryRate || 0}
            change={stats?.deliveryRateChange ?? 0}
            changeLabel="improvement"
            icon={TrendingUp}
            iconColor="text-blue-600"
            iconBgColor="bg-blue-50"
            isPercentage
          />
        </div>

        {/* Quick Actions Section */}
        <Card className="bg-primary text-white mb-8">
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold mb-2">
                  Ready to send your next campaign?
                </h3>
                <p className="text-blue-100">
                  Create engaging SMS campaigns that convert
                </p>
              </div>
              <Button
                asChild
                variant="secondary"
                className="flex items-center space-x-2"
              >
                <Link href="/campaigns">
                  <Plus className="w-4 h-4" />
                  <span>Create Campaign</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No recent activity to display</p>
                <p className="text-sm">
                  Start by creating a campaign or adding contacts
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
