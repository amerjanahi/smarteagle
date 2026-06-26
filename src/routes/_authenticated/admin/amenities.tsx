import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AmenitiesManager from "@/components/admin/AmenitiesManager";
import BookingsManager from "@/components/admin/BookingsManager";

export const Route = createFileRoute("/_authenticated/admin/amenities")({
  head: () => ({ meta: [{ title: "Amenities — Hayy Admin" }] }),
  component: AmenitiesPage,
});

function AmenitiesPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold">Amenities</h1>
        <p className="text-sm text-muted-foreground">Manage facilities and bookings in one place.</p>
      </header>
      <Tabs defaultValue="amenities">
        <TabsList>
          <TabsTrigger value="amenities">Amenities</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
        </TabsList>
        <TabsContent value="amenities" className="mt-4"><AmenitiesManager /></TabsContent>
        <TabsContent value="bookings" className="mt-4"><BookingsManager /></TabsContent>
      </Tabs>
    </div>
  );
}
