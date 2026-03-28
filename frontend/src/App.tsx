import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadTab } from "@/components/UploadTab";
import { SearchTab } from "@/components/SearchTab";
import { Toaster } from "sonner";

function App() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Auction Embedding</h1>
          <p className="text-muted-foreground mt-1">
            Upload and search auction images by visual similarity
          </p>
        </div>
        <Tabs defaultValue="upload">
          <TabsList className="mb-6">
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="search">Search</TabsTrigger>
          </TabsList>
          <TabsContent value="upload">
            <UploadTab />
          </TabsContent>
          <TabsContent value="search">
            <SearchTab />
          </TabsContent>
        </Tabs>
      </div>
      <Toaster richColors />
    </div>
  );
}

export default App;
