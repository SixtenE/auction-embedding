import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadTab } from "@/components/UploadTab";
import { SearchTab } from "@/components/SearchTab";
import { Toaster } from "sonner";
import { motion, AnimatePresence } from "motion/react";

function App() {
  const [activeTab, setActiveTab] = useState("upload");

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl py-8 px-4">
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl font-bold tracking-tight">Auction Embedding</h1>
          <p className="text-muted-foreground mt-1">
            Upload and search auction images by visual similarity
          </p>
        </motion.div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <TabsList className="mb-6">
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="search">Search</TabsTrigger>
            </TabsList>
          </motion.div>
        </Tabs>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === "upload" ? <UploadTab /> : <SearchTab />}
          </motion.div>
        </AnimatePresence>
      </div>
      <Toaster richColors />
    </div>
  );
}

export default App;
