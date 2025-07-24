import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Hash, MessageSquare, Users } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { handleApiError } from "@/lib/handleApiError";
import StatsCard from "@/components/dashboard/stats-card";
import KeywordTable from "@/components/keywords/keyword-table";
import KeywordForm from "@/components/keywords/keyword-form";
import type { KeywordCampaign } from "@shared/schema";

interface KeywordFormData {
  keyword: string;
  message: string;
  expiresAt?: string;
}

export default function Keywords() {
  const { toast } = useToast();

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [deletingKeyword, setDeletingKeyword] = useState<KeywordCampaign | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordCampaign | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Data queries
  const { data: keywords, isLoading: keywordsLoading } = useQuery<KeywordCampaign[]>({
    queryKey: ["/api/keyword-campaigns"],
    staleTime: 30000,
  });

  const { data: keywordStats } = useQuery<{
    activeKeywords: number;
    totalResponses: number;
    newContactsThisMonth: number;
  }>({
    queryKey: ["/api/keyword-campaigns/stats"],
    staleTime: 60000,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: KeywordFormData) =>
      apiRequest({
        method: "POST",
        url: "/api/keyword-campaigns",
        data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keyword-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/keyword-campaigns/stats"] });
      setIsCreateOpen(false);
      toast({ title: "Keyword created successfully" });
    },
    onError: (error) => {
      toast({
        title: "Failed to create keyword",
        description: handleApiError(error),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest({
        method: "DELETE",
        url: `/api/keyword-campaigns/${id}`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keyword-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/keyword-campaigns/stats"] });
      setIsDeleteOpen(false);
      setDeletingKeyword(null);
      toast({ title: "Keyword deleted successfully" });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete keyword",
        description: handleApiError(error),
        variant: "destructive",
      });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest({
        method: "PUT",
        url: `/api/keyword-campaigns/${id}`,
        data: { isActive: true },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keyword-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/keyword-campaigns/stats"] });
      toast({ title: "Keyword activated successfully" });
    },
    onError: (error) => {
      toast({
        title: "Failed to activate keyword",
        description: handleApiError(error),
        variant: "destructive",
      });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest({
        method: "PUT",
        url: `/api/keyword-campaigns/${id}`,
        data: { isActive: false },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keyword-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/keyword-campaigns/stats"] });
      toast({ title: "Keyword deactivated successfully" });
    },
    onError: (error) => {
      toast({
        title: "Failed to deactivate keyword",
        description: handleApiError(error),
        variant: "destructive",
      });
    },
  });

  // Event handlers
  const handleCreate = (data: KeywordFormData) => {
    createMutation.mutate(data);
  };

  const handleActivate = (keyword: KeywordCampaign) => {
    activateMutation.mutate(keyword.id);
  };

  const handleDeactivate = (keyword: KeywordCampaign) => {
    deactivateMutation.mutate(keyword.id);
  };

  const handleDelete = (keyword: KeywordCampaign) => {
    setDeletingKeyword(keyword);
    setIsDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (deletingKeyword) {
      deleteMutation.mutate(deletingKeyword.id);
    }
  };

  const handleViewResponses = (keyword: KeywordCampaign) => {
    setSelectedKeyword(keyword);
    setIsHistoryOpen(true);
  };

  // Filter keywords based on search
  const filteredKeywords = keywords?.filter((keyword) =>
    keyword.keyword.toLowerCase().includes(searchQuery.toLowerCase()) ||
    keyword.message.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="fade-in">
      {/* Header - Copy from campaigns/index.tsx */}
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Keywords</h1>
            <p className="text-gray-600 mt-1">
              Manage auto-response keywords for SMS marketing
            </p>
          </div>
        </div>
      </header>

      <div className="p-8">


        {/* Main Table Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Keyword Campaigns</CardTitle>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Keyword
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search bar - copy from contacts */}
            <div className="flex items-center justify-between mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <KeywordTable
              keywords={filteredKeywords}
              isLoading={keywordsLoading}
              onViewResponses={handleViewResponses}
              onDelete={handleDelete}
              onActivate={handleActivate}
              onDeactivate={handleDeactivate}
            />
          </CardContent>
        </Card>
      </div>

      {/* Create Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Keyword</DialogTitle>
          </DialogHeader>
          <KeywordForm
            onSubmit={handleCreate}
            onCancel={() => setIsCreateOpen(false)}
            pending={createMutation.isPending}
            submitLabel="Create Keyword"
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Keyword</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Are you sure you want to delete the keyword "{deletingKeyword?.keyword}"? 
            This action cannot be undone.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 