import { useState } from "react";
import { UploadTab } from "@/components/UploadTab";
import { SearchTab } from "@/components/SearchTab";
import { Toaster } from "sonner";
import { AnimatePresence, motion } from "motion/react";

function App() {
  const [activeTab, setActiveTab] = useState("upload");

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <h1 className="font-display text-3xl font-medium tracking-tight text-black leading-none">
            Auction Embedding
          </h1>
          <p className="mt-2 text-sm text-[#737373]">
            Upload and search auction images by visual similarity
          </p>
        </div>

        {/* Pill Tabs */}
        <div className="mb-8 flex gap-2">
          {(["upload", "search"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                "rounded-full px-5 py-2 text-sm font-medium transition-none capitalize",
                activeTab === tab
                  ? "bg-[#e5e5e5] text-[#262626]"
                  : "bg-transparent text-[#737373]",
              ].join(" ")}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            {activeTab === "upload" ? <UploadTab /> : <SearchTab />}
          </motion.div>
        </AnimatePresence>
      </div>
      <Toaster />
    </div>
  );
}

export default App;
