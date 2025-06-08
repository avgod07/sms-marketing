import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ContactTable from "@/components/contacts/contact-table";
import ContactForm, { type ContactFormValues } from "@/components/contacts/contact-form";
import { Search, Plus, Download, Upload, Filter } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Contact } from "@shared/schema";
import type { ContactStats } from "@shared/api-types";

export default function Contacts() {
  const [selectedSegment, setSelectedSegment] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(() =>
    localStorage.getItem("contactStatusFilter") || "all",
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { toast } = useToast();

  // Persist filter choice during the session
  useEffect(() => {
    localStorage.setItem("contactStatusFilter", statusFilter);
  }, [statusFilter]);


  const { data: contactStats, isLoading: statsLoading } = useQuery<ContactStats>({
    queryKey: ["/api/contacts/stats", { status: statusFilter }],
  });

  const { data: contacts, isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: [
      "/api/contacts",
      { segment: selectedSegment, search: searchQuery, status: statusFilter },
    ],
  });

  const segments = [
    { key: "all", label: "All Contacts", count: contactStats?.allContacts || 0, color: "bg-blue-100 text-blue-700" },
    { key: "inactive", label: "Inactive", count: contactStats?.inactive || 0, color: "bg-gray-100 text-gray-700" },
    { key: "active", label: "Active Contacts", count: contactStats?.activeContacts || 0, color: "bg-green-100 text-green-700" },
  ];

  const createContactMutation = useMutation({
    mutationFn: (data: ContactFormValues) => {
      const status = data.segment === "inactive" ? "inactive" : "active";
      return apiRequest({ method: "POST", url: "/api/contacts", data: { ...data, status } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/stats"] });
      setIsCreateOpen(false);
      toast({ title: "Contact Added" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add contact",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = (data: ContactFormValues) => {
    createContactMutation.mutate(data);
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setIsEditOpen(true);
  };

  const updateContactMutation = useMutation({
    mutationFn: async (data: ContactFormValues) => {
      if (!editingContact) return;
      const status = data.segment === "inactive" ? "inactive" : "active";
      await apiRequest({ method: "PATCH", url: `/api/contacts/${editingContact.id}`, data: { ...data, status } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/stats"] });
      setIsEditOpen(false);
      setEditingContact(null);
      toast({ title: "Contact Updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update contact",
        variant: "destructive",
      });
    },
  });

  const handleEditSubmit = (data: ContactFormValues) => {
    updateContactMutation.mutate(data);
  };

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
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Contact
                    </Button>
                  </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Contact</DialogTitle>
                  </DialogHeader>
                  <ContactForm
                    onSubmit={handleCreateSubmit}
                    onCancel={() => setIsCreateOpen(false)}
                    pending={createContactMutation.isPending}
                    submitLabel="Add Contact"
                  />
                </DialogContent>
              </Dialog>
              <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit Contact</DialogTitle>
                  </DialogHeader>
                  <ContactForm
                    initialValues={editingContact as ContactFormValues | undefined}
                    onSubmit={handleEditSubmit}
                    onCancel={() => setIsEditOpen(false)}
                    pending={updateContactMutation.isPending}
                    submitLabel="Save Changes"
                  />
                </DialogContent>
              </Dialog>
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Filter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                  >
                    <DropdownMenuRadioItem value="all">
                      All Contacts
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="active">
                      Active
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="inactive">
                      Inactive
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Contact Table */}
            <ContactTable
              contacts={contacts || []}
              isLoading={contactsLoading}
              onEdit={handleEdit}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
