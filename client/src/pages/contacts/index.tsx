import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import ContactTable from "@/components/contacts/contact-table";
import ContactForm, { type ContactFormValues } from "@/components/contacts/contact-form";
import { Search, Plus } from "lucide-react";
import QRCode from "react-qr-code";
import QRious from "qrious";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { handleApiError } from "@/lib/handleApiError";
import { getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSetupStatus } from "@/hooks/use-setup-status";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuth } from "@/hooks/use-auth";
import type { User } from "@shared/schema";
import type { Contact } from "@shared/schema";
import type { ContactRedemption } from "@shared/api-types";
import ContactRedemptionTable from "@/components/contacts/contact-redemption-table";
import { AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { Label } from "@/components/ui/label";
import { Copy, Download, QrCode } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "wouter";

export default function Contacts() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const trimmedSearch = debouncedSearch.trim();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyContact, setHistoryContact] = useState<Contact | null>(null);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const { data: user } = useAuth() as { data: User | null };
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: contacts, isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts", { search: trimmedSearch }],
    enabled: !!user,
  });

  const { data: setup } = useSetupStatus(!!user);

  const {
    data: redemptions,
    isLoading: redemptionsLoading,
  } = useQuery<ContactRedemption[]>({
    queryKey: historyContact
      ? [`/api/contacts/${historyContact.id}/redemptions`]
      : [],
    enabled: !!historyContact,
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const createContactMutation = useMutation({
    mutationFn: (data: ContactFormValues) =>
      apiRequest({
        method: "POST",
        url: "/api/contacts",
        data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/setup/status"] });
      setIsCreateOpen(false);
      setEditingContact(null);
      toast({ title: "Contact Added" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: handleApiError(error),
        variant: "destructive",
      });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: (data: ContactFormValues) =>
      apiRequest({
        method: "PUT",
        url: `/api/contacts/${editingContact!.id}`,
        data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsEditOpen(false);
      setEditingContact(null);
      toast({ title: "Contact Updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: handleApiError(error),
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

  const handleEditSubmit = (data: ContactFormValues) => {
    updateContactMutation.mutate(data);
  };

  const deleteContactMutation = useMutation({
    mutationFn: () =>
      apiRequest({
        method: "DELETE",
        url: `/api/contacts/${deletingContact!.id}`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/setup/status"] });
      setIsDeleteOpen(false);
      setDeletingContact(null);
      toast({ title: "Contact Deleted" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: handleApiError(error),
        variant: "destructive",
      });
    },
  });

  const handleDelete = (contact: Contact) => {
    setDeletingContact(contact);
    setIsDeleteOpen(true);
  };

  const confirmDelete = () => {
    deleteContactMutation.mutate();
  };

  const handleMessage = (contact: Contact) => {
    // Navigate to inbox with the contact pre-selected
    const params = new URLSearchParams();
    params.set('contactId', contact.id.toString());
    params.set('contactName', `${contact.firstName} ${contact.lastName}`);
    params.set('phoneNumber', contact.phoneNumber);
    navigate(`/inbox?${params.toString()}`);
  };

  const loadHtml2Pdf = () => {
    if ((window as any).html2pdf) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.9.2/html2pdf.bundle.min.js";
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.body.appendChild(script);
    });
  };

  const downloadQrPdf = async () => {
    try {
      await loadHtml2Pdf();
      const joinUrl = `${window.location.origin}/join/${user?.businessId || ''}`;
      const element = document.createElement("div");
      element.innerHTML = `
        <div style="text-align: center; padding: 20px; font-family: Arial, sans-serif;">
          <h2 style="margin-bottom: 20px;">Join Our SMS List</h2>
          <div style="display: flex; justify-content: center; margin-bottom: 20px;">
            <div id="qr-code"></div>
          </div>
          <p style="font-size: 16px; margin-bottom: 10px;">Scan the QR code to join our SMS list</p>
          <p style="font-size: 14px; color: #666;">${joinUrl}</p>
        </div>
      `;
      document.body.appendChild(element);
      const qrCodeDiv = element.querySelector("#qr-code");
      if (qrCodeDiv) {
        qrCodeDiv.innerHTML = `<canvas id="qr-canvas"></canvas>`;
        const canvas = qrCodeDiv.querySelector("canvas") as HTMLCanvasElement;
        if (canvas) {
          new QRious({
            element: canvas,
            value: joinUrl,
            size: 200,
          });
        }
      }
      const options = {
        margin: 0.5,
        filename: "sms-signup-qr.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
      };
      await (window as any).html2pdf().set(options).from(element).save();
      document.body.removeChild(element);
      toast({ title: "QR Code Downloaded", description: "PDF saved successfully" });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  // Only disable if onboarding is not complete
  const disabled = !setup?.onboardingComplete;

  return (
    <div className="fade-in">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contact Management</h1>
            <p className="text-gray-600 mt-1">Manage your contact list.</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-8">
        {disabled && (
          <Alert className="mb-6 bg-yellow-50 border-yellow-400 text-yellow-700">
            <AlertTitle>Finish Setup</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>Complete your onboarding to start adding contacts and sending messages.</p>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href="/onboarding">Complete Setup</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Contact Management Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <span>All Contacts</span>
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={disabled}>
                      <QrCode className="w-4 h-4 mr-2" />
                      QR Code
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-center">Join Link QR Code</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-6">
                      {/* QR Code Display */}
                      <div className="flex justify-center p-6 bg-white rounded-lg border-2 border-gray-200">
                        {user?.businessId ? (
                          <QRCode
                            id="business-qr-code"
                            value={`${window.location.origin}/join/${user.businessId}`}
                            size={200}
                            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                          />
                        ) : (
                          <Skeleton className="h-48 w-48" />
                        )}
                      </div>

                      {/* Instructions */}
                      <div className="text-center space-y-2">
                        <p className="text-sm font-medium text-gray-900">
                          Share this QR code with customers
                        </p>
                        <p className="text-xs text-gray-600">
                          When scanned, customers will be taken to your contact signup page
                        </p>
                      </div>

                      {/* Join URL Display */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-700">Direct Link:</Label>
                        <div className="flex items-center space-x-2">
                          <Input
                            readOnly
                            value={`${window.location.origin}/join/${user?.businessId || ''}`}
                            className="text-xs bg-gray-50 border-gray-200"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const url = `${window.location.origin}/join/${user?.businessId}`;
                              navigator.clipboard.writeText(url);
                              toast({ title: "Link copied to clipboard!" });
                            }}
                            className="shrink-0"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          onClick={downloadQrPdf}
                          className="flex-1"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download PDF
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            const canvas = document.createElement('canvas');
                            const svgElement = document.getElementById('business-qr-code');
                            if (svgElement && svgElement.tagName === 'svg') {
                              const svg = svgElement as unknown as SVGSVGElement;
                              const svgData = new XMLSerializer().serializeToString(svg);
                              const img = new Image();
                              img.onload = () => {
                                canvas.width = img.width;
                                canvas.height = img.height;
                                const ctx = canvas.getContext('2d');
                                ctx?.drawImage(img, 0, 0);
                                const link = document.createElement('a');
                                link.download = 'qr-code.png';
                                link.href = canvas.toDataURL();
                                link.click();
                              };
                              img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
                            }
                          }}
                          className="flex-1"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download PNG
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" disabled={disabled}>
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
              <Dialog
                open={isHistoryOpen}
                onOpenChange={(open) => {
                  setIsHistoryOpen(open);
                  if (!open) setHistoryContact(null);
                }}
              >
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>
                      Redemption History for {historyContact?.firstName} {historyContact?.lastName}
                    </DialogTitle>
                  </DialogHeader>
                  <ContactRedemptionTable
                    redemptions={redemptions || []}
                    isLoading={redemptionsLoading}
                  />
                </DialogContent>
              </Dialog>
              <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Contact</AlertDialogTitle>
                  </AlertDialogHeader>
                  <p className="text-sm text-muted-foreground mb-4">
                    Are you sure you want to delete this contact? This action cannot be undone.
                  </p>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
          <CardContent>
            {/* Search */}
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
            </div>

            {/* Contact Table */}
            <ContactTable
              contacts={contacts || []}
              isLoading={contactsLoading}
              hasContacts={!!setup?.hasContacts}
              onEdit={handleEdit}
              onViewRedemptions={(c) => {
                setHistoryContact(c);
                setIsHistoryOpen(true);
              }}
              onDelete={handleDelete}
              onMessage={handleMessage}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
