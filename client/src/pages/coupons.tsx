import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import CouponForm, { type CouponFormValues } from "@/components/coupons/coupon-form";
import CouponTable from "@/components/coupons/coupon-table";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Coupon } from "@shared/schema";

export default function Coupons() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deletingCoupon, setDeletingCoupon] = useState<Coupon | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const { toast } = useToast();

  const { data: coupons, isLoading } = useQuery<Coupon[]>({
    queryKey: ["/api/coupons"],
  });

  const createCouponMutation = useMutation({
    mutationFn: (data: CouponFormValues) => apiRequest({ method: "POST", url: "/api/coupons", data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      setIsCreateOpen(false);
      toast({ title: "Coupon Created" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create coupon",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = (data: CouponFormValues) => {
    createCouponMutation.mutate(data);
  };

  const updateCouponMutation = useMutation({
    mutationFn: (data: CouponFormValues) =>
      apiRequest({ method: "PATCH", url: `/api/coupons/${editingCoupon!.id}`, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      setIsEditOpen(false);
      setEditingCoupon(null);
      toast({ title: "Coupon Updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update coupon",
        variant: "destructive",
      });
    },
  });

  const handleEditSubmit = (data: CouponFormValues) => {
    updateCouponMutation.mutate(data);
  };

  const deleteCouponMutation = useMutation({
    mutationFn: () => apiRequest({ method: "DELETE", url: `/api/coupons/${deletingCoupon!.id}` }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      setIsDeleteOpen(false);
      setDeletingCoupon(null);
      toast({ title: "Coupon Deleted" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete coupon",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setIsEditOpen(true);
  };

  const handleDelete = (coupon: Coupon) => {
    setDeletingCoupon(coupon);
    setIsDeleteOpen(true);
  };

  const confirmDelete = () => {
    deleteCouponMutation.mutate();
  };

  return (
    <div className="fade-in">
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Coupon Management</h1>
            <p className="text-gray-600 mt-1">Create and manage your coupons.</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>Create Coupon</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Coupon</DialogTitle>
              </DialogHeader>
              <CouponForm onSubmit={handleCreateSubmit} onCancel={() => setIsCreateOpen(false)} pending={createCouponMutation.isPending} submitLabel="Create Coupon" />
            </DialogContent>
          </Dialog>
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Coupon</DialogTitle>
              </DialogHeader>
              <CouponForm initialValues={editingCoupon as CouponFormValues | undefined} onSubmit={handleEditSubmit} onCancel={() => setIsEditOpen(false)} pending={updateCouponMutation.isPending} submitLabel="Save Changes" />
            </DialogContent>
          </Dialog>
          <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Coupon</AlertDialogTitle>
              </AlertDialogHeader>
              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to delete {deletingCoupon?.code}? This action cannot be undone.
              </p>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>
      <div className="p-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Coupons</CardTitle>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Coupon
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <CouponTable coupons={coupons || []} isLoading={isLoading} onEdit={handleEdit} onDelete={handleDelete} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
