import { useState } from "react";
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
import ContactTable from "@/components/contacts/contact-table";
import { Search, Plus, Download, Upload, Filter } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import type { Contact } from "@shared/schema";
import type { ContactStats } from "@shared/api-types";

export default function Contacts() {
  const [selectedSegment, setSelectedSegment] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { toast } = useToast();

  const contactSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phoneNumber: z
      .string()
      .regex(/^\+?[1-9]\d{1,14}$/, "Enter phone in E.164 format e.g. +15551234567"),
    email: z.string().email().optional().or(z.literal("")),
    segment: z.string().min(1, "Segment is required"),
  });

  type ContactForm = z.infer<typeof contactSchema>;

  const form = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      email: "",
      segment: "all",
    },
  });

  const { data: contactStats, isLoading: statsLoading } = useQuery<ContactStats>({
    queryKey: ["/api/contacts/stats"],
  });

  const { data: contacts, isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts", { segment: selectedSegment, search: searchQuery }],
  });

  const segments = [
    { key: "all", label: "All Contacts", count: contactStats?.allContacts || 0, color: "bg-blue-100 text-blue-700" },
    { key: "vip", label: "VIP Customers", count: contactStats?.vipCustomers || 0, color: "bg-purple-100 text-purple-700" },
    { key: "new_leads", label: "New Leads", count: contactStats?.newLeads || 0, color: "bg-green-100 text-green-700" },
    { key: "inactive", label: "Inactive", count: contactStats?.inactive || 0, color: "bg-gray-100 text-gray-700" },
  ];

  const createContactMutation = useMutation({
    mutationFn: (data: ContactForm) => apiRequest("POST", "/api/contacts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/stats"] });
      setIsCreateOpen(false);
      form.reset();
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

  const handleSubmit = (data: ContactForm) => {
    createContactMutation.mutate(data);
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
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                      <div>
                        <Label htmlFor="firstName">First Name</Label>
                        <Input id="firstName" {...form.register("firstName")} placeholder="First name" />
                        {form.formState.errors.firstName && (
                          <p className="text-sm text-red-600 mt-1">{form.formState.errors.firstName.message}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input id="lastName" {...form.register("lastName" )} placeholder="Last name" />
                        {form.formState.errors.lastName && (
                          <p className="text-sm text-red-600 mt-1">{form.formState.errors.lastName.message}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="phoneNumber">Phone Number</Label>
                        <Input id="phoneNumber" {...form.register("phoneNumber")} placeholder="+15551234567" />
                        {form.formState.errors.phoneNumber && (
                          <p className="text-sm text-red-600 mt-1">{form.formState.errors.phoneNumber.message}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" {...form.register("email")} placeholder="optional" />
                        {form.formState.errors.email && (
                          <p className="text-sm text-red-600 mt-1">{form.formState.errors.email.message}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="segment">Segment</Label>
                        <Select onValueChange={(value) => form.setValue("segment", value)} defaultValue="all">
                          <SelectTrigger>
                            <SelectValue placeholder="Select segment" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Contacts</SelectItem>
                            <SelectItem value="vip">VIP Customers</SelectItem>
                            <SelectItem value="new_leads">New Leads</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                        {form.formState.errors.segment && (
                          <p className="text-sm text-red-600 mt-1">{form.formState.errors.segment.message}</p>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="flex-1">
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createContactMutation.isPending} className="flex-1">
                          {createContactMutation.isPending ? "Adding..." : "Add Contact"}
                        </Button>
                      </div>
                    </form>
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
