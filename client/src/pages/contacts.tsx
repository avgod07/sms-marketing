import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ContactTable from "@/components/contacts/contact-table";
import { Search, Plus, Download, Upload, Filter } from "lucide-react";
import { formatNumber, getSegmentColor } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";

export default function Contacts() {
  const [selectedSegment, setSelectedSegment] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: contactStats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/contacts/stats"],
  });

  const { data: contacts, isLoading: contactsLoading } = useQuery({
    queryKey: ["/api/contacts", { segment: selectedSegment, search: searchQuery }],
  });

  const segments = [
    { key: "all", label: "All Contacts", count: contactStats?.allContacts || 0, color: "bg-blue-100 text-blue-700" },
    { key: "vip", label: "VIP Customers", count: contactStats?.vipCustomers || 0, color: "bg-purple-100 text-purple-700" },
    { key: "new_leads", label: "New Leads", count: contactStats?.newLeads || 0, color: "bg-green-100 text-green-700" },
    { key: "inactive", label: "Inactive", count: contactStats?.inactive || 0, color: "bg-gray-100 text-gray-700" },
  ];

  return (
    <div className="fade-in">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contact Management</h1>
            <p className="text-gray-600 mt-1">
              Manage your contact lists and segments.
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-8">
        {/* Segment Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {segments.map((segment) => (
            <Card 
              key={segment.key}
              className={`card-hover cursor-pointer ${selectedSegment === segment.key ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setSelectedSegment(segment.key)}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">{segment.label}</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatNumber(segment.count)}
                    </p>
                  </div>
                  <Badge className={segment.color}>
                    {segment.label.split(' ').map(word => word[0]).join('')}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Contact Management Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <span>Contact Management</span>
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm">
                  <Upload className="w-4 h-4 mr-2" />
                  Import
                </Button>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Contact
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search and Filter */}
            <div className="flex items-center justify-between mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </div>

            {/* Contact Table */}
            <ContactTable 
              contacts={contacts || []} 
              isLoading={contactsLoading}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
