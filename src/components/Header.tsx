"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Upload,
  FolderPlus,
  FolderUp,
  LogOut,
  LayoutGrid,
  List,
  ArrowDownAZ,
  ArrowUpAZ,
  Sun,
  Moon,
  FileText,
  ChevronDown,
  X,
  Link as LinkIcon,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useObjectStore } from "@/hooks/useObjectStore";
import { Button } from "./ui/Button";
import { filesFromDirectoryInput } from "@/lib/dnd";
import UrlImportModal from "./UrlImportModal";
import { CloudflareLogo } from "./CloudflareLogo";
import { useTheme } from "./ThemeProvider";
import { toast } from "@/lib/toast";

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const {
    searchQuery,
    setSearchQuery,
    createFolder,
    addFolderPickerUploads,
    startDnDUpload,
    viewMode,
    setViewMode,
    sortOrder,
    setSortOrder,
    currentPrefix,
  } = useObjectStore();

  const [openSearch, setOpenSearch] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [urlModalOpen, setUrlModalOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchPopoverRef = useRef<HTMLDivElement | null>(null);
  const searchTriggerRef = useRef<HTMLButtonElement | null>(null);
  const actionsDropdownRef = useRef<HTMLDivElement | null>(null);
  const actionsTriggerRef = useRef<HTMLButtonElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  // Focus search input when popover opens
  useEffect(() => {
    if (openSearch) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 180);
      return () => clearTimeout(t);
    }
  }, [openSearch]);

  // Close menus on outside click or Escape
  useEffect(() => {
    function handleDown(e: MouseEvent) {
      const target = e.target as Node | null;

      // Search popover
      if (openSearch) {
        const inSearch = searchPopoverRef.current?.contains(target) ?? false;
        const inTrigger = searchTriggerRef.current?.contains(target) ?? false;
        if (!inSearch && !inTrigger) setOpenSearch(false);
      }

      // Actions dropdown
      if (actionsMenuOpen) {
        const inDropdown = actionsDropdownRef.current?.contains(target) ?? false;
        const inTrigger = actionsTriggerRef.current?.contains(target) ?? false;
        if (!inDropdown && !inTrigger) setActionsMenuOpen(false);
      }
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenSearch(false);
        setActionsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [openSearch, actionsMenuOpen]);

  // Paste image handler (supports uploading pasted screenshot/images)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const itemArray = Array.from(items);
      const images: File[] = [];

      for (const item of itemArray) {
        if (item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (blob) {
            let ext = "png";
            if (blob.type === "image/gif") ext = "gif";
            else if (blob.type === "image/jpeg" || blob.type === "image/jpg") ext = "jpg";
            else if (blob.type === "image/webp") ext = "webp";
            else if (blob.type === "image/svg+xml") ext = "svg";
            const file = new File([blob], `pasted-${Date.now()}.${ext}`, {
              type: blob.type,
            });
            images.push(file);
          }
        }
      }

      if (images.length === 0) return;

      try {
        const entries = images.map((file) => ({
          file,
          relativePath: file.name,
        }));
        await startDnDUpload(entries);
        toast.info("Uploading pasted image...");
      } catch (err) {
        console.error("Paste upload failed:", err);
        toast.error("Paste upload failed");
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [currentPrefix, startDnDUpload]);

  const logOut = () => {
    document.cookie = "site_auth=; Max-Age=0; path=/;";
    window.location.reload();
  };

  const handleNewFolder = async () => {
    setActionsMenuOpen(false);
    const name = window.prompt("New folder name");
    if (!name) return;
    try {
      await createFolder(name);
    } catch (e: any) {
      console.error(e);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0f172a]/90 backdrop-blur-xl border-b border-black/5 dark:border-white/[0.08] transition-colors">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo ngắn 1 dòng (không bị wrap xuống hàng) */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 min-w-0">
            <CloudflareLogo className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
            <h1 className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-gray-900 dark:text-white whitespace-nowrap truncate">
              R2 Cloudflare
            </h1>
          </div>

          {/* Right Header items */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Hidden file & folder inputs */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={async (e) => {
                const filesList = e.target.files;
                if (!filesList || filesList.length === 0) return;
                const files = Array.from(filesList);
                try {
                  const entries = files.map((file) => ({
                    file,
                    relativePath: file.name,
                  }));
                  await startDnDUpload(entries);
                } finally {
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }
              }}
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              // @ts-ignore - Chromium specific folder selection
              webkitdirectory=""
              className="hidden"
              onChange={async (e) => {
                const list = e.target.files;
                if (!list || list.length === 0) return;
                try {
                  const entries = filesFromDirectoryInput(list);
                  await addFolderPickerUploads(entries);
                } finally {
                  if (folderInputRef.current) folderInputRef.current.value = "";
                }
              }}
            />

            {/* Desktop Toolbar: Sort + View + Theme + Search */}
            <div className="hidden sm:flex items-center gap-1 bg-gray-100 dark:bg-white/[0.05] p-1 rounded-xl border border-black/5 dark:border-white/[0.06]">
              <button
                aria-label="Newest"
                onClick={() => setSortOrder("newest")}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  sortOrder === "newest"
                    ? "bg-amber-500/20 text-amber-500 dark:text-amber-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
                title="Mới nhất"
              >
                <ArrowUpAZ className="w-4 h-4" />
              </button>
              <button
                aria-label="Oldest"
                onClick={() => setSortOrder("oldest")}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  sortOrder === "oldest"
                    ? "bg-amber-500/20 text-amber-500 dark:text-amber-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
                title="Cũ nhất"
              >
                <ArrowDownAZ className="w-4 h-4" />
              </button>
              <div className="w-[1px] h-3.5 bg-black/10 dark:bg-white/10 mx-0.5" />
              <button
                aria-label="Grid view"
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-amber-500/20 text-amber-500 dark:text-amber-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                aria-label="List view"
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === "list"
                    ? "bg-amber-500/20 text-amber-500 dark:text-amber-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <div className="w-[1px] h-3.5 bg-black/10 dark:bg-white/10 mx-0.5" />
              <button
                aria-label={theme === "dark" ? "Light Mode" : "Dark Mode"}
                onClick={toggleTheme}
                className="p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition cursor-pointer"
                title={theme === "dark" ? "Chuyển sang nền sáng" : "Chuyển sang nền tối"}
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>
              <button
                aria-label="Search"
                ref={searchTriggerRef}
                onClick={() => setOpenSearch((v) => !v)}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  openSearch
                    ? "bg-amber-500/20 text-amber-500 dark:text-amber-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
                title="Search"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Toolbar: Theme + Search */}
            <div className="flex sm:hidden items-center gap-1 bg-gray-100 dark:bg-white/[0.05] p-1 rounded-xl border border-black/5 dark:border-white/[0.06] shrink-0">
              <button
                aria-label={theme === "dark" ? "Light Mode" : "Dark Mode"}
                onClick={toggleTheme}
                className="p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition cursor-pointer"
                title={theme === "dark" ? "Chuyển sang nền sáng" : "Chuyển sang nền tối"}
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>
              <button
                aria-label="Search"
                onClick={() => setOpenSearch((v) => !v)}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  openSearch
                    ? "bg-amber-500/20 text-amber-500 dark:text-amber-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
                title="Search"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>

            {/* Menu Dropdown Actions: nằm ở góc phải ngoài cùng để dropdown mở khớp mép phải màn hình */}
            <div className="relative shrink-0">
              <Button
                ref={actionsTriggerRef}
                variant="secondary"
                onClick={() => setActionsMenuOpen((v) => !v)}
                className="group gap-1.5 sm:gap-2 cursor-pointer bg-white dark:bg-white/[0.06] hover:bg-gray-100 dark:hover:bg-white/[0.1] text-gray-800 dark:text-gray-200 border border-black/5 dark:border-white/[0.08] shadow-sm rounded-xl py-1.5 px-2.5 sm:py-2 sm:px-3 text-xs sm:text-sm font-medium transition shrink-0"
                title="Actions Menu"
              >
                <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
                <span className="text-xs sm:text-sm">Actions</span>
                <ChevronDown
                  className={`w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform duration-200 ${
                    actionsMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </Button>

              <AnimatePresence>
                {actionsMenuOpen && (
                  <motion.div
                    ref={actionsDropdownRef}
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute right-0 mt-2 w-60 sm:w-56 max-w-[calc(100vw-24px)] rounded-2xl bg-white dark:bg-[#161e31] border border-black/10 dark:border-white/[0.1] shadow-2xl shadow-black/50 py-1.5 z-50 backdrop-blur-2xl overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={handleNewFolder}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition text-left cursor-pointer"
                    >
                      <FolderPlus className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>New Folder</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActionsMenuOpen(false);
                        folderInputRef.current?.click();
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition text-left cursor-pointer"
                    >
                      <FolderUp className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>Upload Folder</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActionsMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition text-left cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Upload File</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActionsMenuOpen(false);
                        setUrlModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition text-left cursor-pointer"
                    >
                      <LinkIcon className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>Import URL</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActionsMenuOpen(false);
                        window.open("/document", "_blank");
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition text-left cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>API Docs</span>
                    </button>

                    {/* Mobile only controls inside Actions menu: mỗi mục 1 dòng chuẩn chỉn chu, không bị ngắt chữ */}
                    <div className="sm:hidden border-t border-black/5 dark:border-white/[0.08] my-1 pt-1">
                      <div className="px-3.5 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        Hiển thị & Sắp xếp
                      </div>
                      <button
                        type="button"
                        onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                        className="w-full flex items-center justify-between px-3.5 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          {viewMode === "grid" ? <List className="w-4 h-4 text-amber-500 shrink-0" /> : <LayoutGrid className="w-4 h-4 text-amber-500 shrink-0" />}
                          <span>Chế độ hiển thị</span>
                        </div>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/[0.08] text-gray-600 dark:text-gray-300">
                          {viewMode === "grid" ? "Lưới" : "Danh sách"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
                        className="w-full flex items-center justify-between px-3.5 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          {sortOrder === "newest" ? <ArrowDownAZ className="w-4 h-4 text-amber-500 shrink-0" /> : <ArrowUpAZ className="w-4 h-4 text-amber-500 shrink-0" />}
                          <span>Sắp xếp</span>
                        </div>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/[0.08] text-gray-600 dark:text-gray-300">
                          {sortOrder === "newest" ? "Mới nhất" : "Cũ nhất"}
                        </span>
                      </button>
                    </div>

                    <div className="my-1 border-t border-black/5 dark:border-white/[0.08]" />

                    <button
                      type="button"
                      onClick={() => {
                        setActionsMenuOpen(false);
                        logOut();
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs sm:text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition text-left cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      <span>Sign Out</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Search popover */}
        <AnimatePresence>
          {openSearch && (
            <motion.div
              ref={searchPopoverRef}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="mt-2 flex justify-end"
            >
              <div className="flex items-center gap-2 bg-white dark:bg-[#161e31] shadow-xl border border-black/10 dark:border-white/[0.1] rounded-2xl pl-3.5 pr-2 py-1.5 w-full sm:w-80 backdrop-blur-xl">
                <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search files or prefixes..."
                  className="w-full bg-transparent outline-none text-xs sm:text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="p-1 rounded-md text-gray-400 hover:text-gray-200 transition text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {urlModalOpen && (
          <UrlImportModal
            open={urlModalOpen}
            onClose={() => setUrlModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </header>
  );
}
