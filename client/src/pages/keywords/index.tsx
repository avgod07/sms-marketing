import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, MoreVertical, CheckCircle, XCircle, MessageSquare, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KeywordForm } from "./KeywordForm";
import { TestMessageDialog } from "./TestMessageDialog";
import { api } from "@/lib/api";
import { getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Keyword {
  id: number;
  keyword: string;
  welcomeMessage: string;
  isActive: boolean;
  optInCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function KeywordsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<Keyword | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch keywords
  const { data: keywords = [], isLoading } = useQuery<Keyword[]>({
    queryKey: ["/api/keywords"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Delete keyword mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/keywords/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
      toast({ title: "Keyword deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete keyword", variant: "destructive" });
    },
  });

  // Toggle keyword status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api.put(`/api/keywords/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
      toast({ title: "Keyword status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update keyword status", variant: "destructive" });
    },
  });

  const handleEdit = (keyword: Keyword) => {
    setEditingKeyword(keyword);
    setIsFormOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this keyword?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleToggleStatus = (keyword: Keyword) => {
    toggleStatusMutation.mutate({
      id: keyword.id,
      isActive: !keyword.isActive,
    });
  };

  const handleTestMessage = (keyword: Keyword) => {
    setSelectedKeyword(keyword);
    setTestDialogOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingKeyword(null);
  };

  const handleFormSuccess = () => {
    handleFormClose();
    queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Keyword Management</h1>
            <p className="text-gray-600 mt-1">Manage SMS keywords for customer opt-ins.</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <span>Keyword Management</span>
              </CardTitle>
              <Button size="sm" onClick={() => setIsFormOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> Add Keyword
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : keywords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No keywords found</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Get started by adding your first keyword.
                </p>
                <Button onClick={() => setIsFormOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Add Keyword
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Keyword</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Welcome Message</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Opt-ins</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keywords.map((keyword: Keyword) => (
                      <tr key={keyword.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4 font-medium text-gray-900">{keyword.keyword}</td>
                        <td className="py-4 px-4 truncate max-w-xs">{keyword.welcomeMessage}</td>
                        <td className="py-4 px-4 text-center">
                          {keyword.isActive ? (
                            <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">Active</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-gray-200">Inactive</Badge>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">{keyword.optInCount}</td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTestMessage(keyword)}
                              title="Send Test Message"
                            >
                              <MessageSquare className="w-4 h-4 mr-1" /> Test
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="ml-1">
                                  <MoreVertical className="w-5 h-5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(keyword)}>
                                  <Edit className="w-4 h-4 mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleStatus(keyword)}>
                                  {keyword.isActive ? (
                                    <>
                                      <EyeOff className="w-4 h-4 mr-2" /> Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="w-4 h-4 mr-2" /> Activate
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(keyword.id)} className="text-destructive">
                                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Keyword Form Dialog */}
        <KeywordForm
          open={isFormOpen}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          keyword={editingKeyword}
        />

        {/* Test Message Dialog */}
        <TestMessageDialog
          open={testDialogOpen}
          onClose={() => setTestDialogOpen(false)}
          keyword={selectedKeyword}
        />
      </div>
    </div>
  );
} 