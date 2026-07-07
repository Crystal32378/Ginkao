'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { GinkgoLeaf, GinkgoSpinning, GinkgoRain } from '@/components/ginkgo-leaf'
import { type MemorySummary, type ActionItem, formatMemoryCard } from '@/lib/memory'
import {
  Plus,
  ArrowLeft,
  Sparkles,
  Copy,
  Trash2,
  History,
  RotateCcw,
  Code2,
  FlaskConical,
  Leaf,
  MessageSquare,
  Link as LinkIcon,
  Download,
  ExternalLink,
} from 'lucide-react'

// ==================== Types ====================
interface Project {
  id: string
  name: string
  description: string | null
  emoji: string
  createdAt: string
  updatedAt: string
  _count?: { pills: number }
}

interface PillMeta {
  id: string
  title: string | null
  isCurrent: boolean
  previousPillId: string | null
  createdAt: string
}

interface PillFull extends PillMeta {
  summary: MemorySummary
  conversationText: string
}

// ==================== Main Page ====================
export default function Home() {
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-stone-50 to-emerald-50">
      <Header />
      <main className="flex-1 container mx-auto max-w-6xl px-4 py-6 md:py-10">
        {view === 'list' ? (
          <ProjectListView
            onOpen={(p) => {
              setSelectedProject(p)
              setView('detail')
            }}
          />
        ) : (
          <ProjectDetailView
            project={selectedProject}
            onBack={() => {
              setView('list')
              setSelectedProject(null)
            }}
          />
        )}
      </main>
      <Footer />
      <Toaster />
    </div>
  )
}

// ==================== Header ====================
function Header() {
  return (
    <header className="border-b border-amber-200/60 bg-amber-50/40 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2 text-amber-700">
          <GinkgoLeaf size={28} className="text-amber-600" />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-stone-800">銀杏藥局</h1>
            <p className="text-[10px] text-stone-500 -mt-0.5">Ginkgo Pharmacy · 治療 AI 失憶症</p>
          </div>
        </div>
        <div className="ml-auto hidden sm:flex items-center gap-1.5 text-xs text-stone-500">
          <Badge variant="outline" className="bg-amber-100/60 border-amber-200 text-amber-800">
            <Leaf className="w-3 h-3 mr-1" />
            4 段式記憶
          </Badge>
          <Badge variant="outline" className="bg-emerald-100/60 border-emerald-200 text-emerald-800">
            <History className="w-3 h-3 mr-1" />
            滾動 + 回滾
          </Badge>
        </div>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-amber-200/60 bg-amber-50/30">
      <div className="container mx-auto max-w-6xl px-4 py-4 text-xs text-stone-500 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <GinkgoLeaf size={12} className="text-amber-600" />
          一鍵保存對話，後台偷偷幫你煉成記憶藥丸
        </span>
        <span className="text-stone-400">local-first · SQLite · 不上雲</span>
      </div>
    </footer>
  )
}

// ==================== Project List View ====================
function ProjectListView({ onOpen }: { onOpen: (p: Project) => void }) {
  const { toast } = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '', emoji: '🌿' })

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      setProjects(data.projects ?? [])
    } catch (err) {
      toast({ title: '載入專案失敗', description: String(err), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const handleCreate = async () => {
    if (!newProject.name.trim()) {
      toast({ title: '請填專案名稱', variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(newProject),
      })
      if (!res.ok) throw new Error('create failed')
      await fetchProjects()
      setNewProject({ name: '', description: '', emoji: '🌿' })
      toast({ title: '專案已建立', description: '可以開始煉丹了' })
    } catch (err) {
      toast({ title: '建立失敗', description: String(err), variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      await fetchProjects()
      toast({ title: '專案已刪除' })
    } catch (err) {
      toast({ title: '刪除失敗', description: String(err), variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero 區 */}
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-emerald-50/50 relative overflow-hidden">
        <GinkgoRain count={6} />
        <CardContent className="pt-8 pb-8 relative z-10">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-[280px]">
              <h2 className="text-2xl md:text-3xl font-bold text-stone-800 mb-2 flex items-center gap-2 flex-wrap">
                治療 AI 失憶症
                <span className="text-amber-600">
                  <GinkgoLeaf size={28} className="inline" />
                </span>
              </h2>
              <p className="text-stone-600 text-sm leading-relaxed">
                把冗長的對話變成一顆結構化的記憶藥丸。下次開新對話前服用一顆，
                AI 就不會重新提問已經討論過的事、不會推翻已定案的決策、不會提議已被否決的方向。
              </p>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <FeaturePill icon="✅" label="決策" />
                <FeaturePill icon="⚠️" label="開放問題" />
                <FeaturePill icon="📋" label="行動項" />
                <FeaturePill icon="🎯" label="背景錨點" />
              </div>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-amber-600 hover:bg-amber-700 text-white shadow-md">
                  <Plus className="w-4 h-4 mr-1" />
                  新增專案
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <GinkgoLeaf size={20} className="text-amber-600" />
                    新增記憶專案
                  </DialogTitle>
                  <DialogDescription>
                    不同專案的記憶互相隔離 — 換專案就換一整組記憶，避免汙染。
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="p-name">專案名稱 *</Label>
                    <Input
                      id="p-name"
                      placeholder="例如：銀杏藥局產品開發"
                      value={newProject.name}
                      onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="p-emoji">代表 emoji</Label>
                    <Input
                      id="p-emoji"
                      placeholder="🌿"
                      className="w-20 text-center text-lg"
                      value={newProject.emoji}
                      onChange={(e) => setNewProject({ ...newProject, emoji: e.target.value.slice(0, 4) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="p-desc">簡介（可選）</Label>
                    <Textarea
                      id="p-desc"
                      placeholder="這個專案在做什么？"
                      rows={2}
                      value={newProject.description}
                      onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreate} disabled={creating} className="bg-amber-600 hover:bg-amber-700">
                    {creating ? '建立中…' : '建立'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* 專案列表 */}
      <section>
        <h3 className="text-lg font-semibold text-stone-700 mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-amber-600" />
          你的記憶專案
        </h3>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyProjects />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p)} onDelete={() => handleDelete(p.id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function FeaturePill({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-white/70 border border-amber-200/60 rounded-full px-3 py-1.5 text-stone-700">
      <span>{icon}</span>
      <span className="font-medium">{label}</span>
    </div>
  )
}

function EmptyProjects() {
  return (
    <Card className="border-dashed border-amber-200 bg-amber-50/30 relative overflow-hidden">
      <GinkgoRain count={4} />
      <CardContent className="py-12 text-center relative z-10">
        <div className="text-amber-600 mb-3 flex justify-center">
          <GinkgoLeaf size={48} />
        </div>
        <p className="text-stone-600 mb-1">還沒有專案</p>
        <p className="text-xs text-stone-400">按上面的「新增專案」開始你的第一顆藥丸</p>
      </CardContent>
    </Card>
  )
}

function ProjectCard({ project, onOpen, onDelete }: { project: Project; onOpen: () => void; onDelete: () => void }) {
  return (
    <Card className="group hover:shadow-md transition-all border-amber-100 bg-white hover:border-amber-300 relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2">
          <span className="text-2xl">{project.emoji}</span>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base text-stone-800 truncate">{project.name}</CardTitle>
            <CardDescription className="text-xs text-stone-500 mt-0.5">
              {new Date(project.updatedAt).toLocaleDateString('zh-TW')}
            </CardDescription>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="opacity-0 group-hover:opacity-100 transition text-stone-400 hover:text-red-500 p-1"
                aria-label="刪除"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>刪除這個專案？</AlertDialogTitle>
                <AlertDialogDescription>
                  這會連同所有藥丸一併刪除，無法復原。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-red-500 hover:bg-red-600">
                  刪除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        <p className="text-xs text-stone-500 line-clamp-2 min-h-[2rem]">
          {project.description || '（沒有簡介）'}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-xs">
            <FlaskConical className="w-3 h-3 mr-1" />
            {project._count?.pills ?? 0} 顆藥丸
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button onClick={onOpen} variant="outline" className="w-full border-amber-200 text-amber-700 hover:bg-amber-50">
          打開藥櫃
        </Button>
      </CardFooter>
    </Card>
  )
}

// ==================== Project Detail View ====================
function ProjectDetailView({ project, onBack }: { project: Project | null; onBack: () => void }) {
  const { toast } = useToast()
  const [pills, setPills] = useState<PillFull[]>([])
  const [pillsMeta, setPillsMeta] = useState<PillMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [conversation, setConversation] = useState('')
  const [refining, setRefining] = useState(false)
  const [showApiHelp, setShowApiHelp] = useState(false)

  const fetchPills = useCallback(async () => {
    if (!project) return
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/pills`)
      const data = await res.json()
      setPills(data.pills ?? [])
      setPillsMeta(
        (data.pills ?? []).map((p: PillFull) => ({
          id: p.id,
          title: p.title,
          isCurrent: p.isCurrent,
          previousPillId: p.previousPillId,
          createdAt: p.createdAt,
        })),
      )
    } catch (err) {
      toast({ title: '載入藥丸失敗', description: String(err), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [project, toast])

  useEffect(() => {
    fetchPills()
  }, [fetchPills])

  const handleRefine = async () => {
    if (!project) return
    if (!conversation.trim()) {
      toast({ title: '請貼上對話內容', variant: 'destructive' })
      return
    }
    setRefining(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/pills`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationText: conversation }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'refine failed')
      }
      const data = await res.json()
      toast({
        title: '煉丹完成 🌿',
        description: `新藥丸：${data.pill?.title ?? ''}`,
      })
      setConversation('')
      await fetchPills()
    } catch (err) {
      toast({ title: '煉丹失敗', description: String(err), variant: 'destructive' })
    } finally {
      setRefining(false)
    }
  }

  const handleRollback = async (pillId: string) => {
    if (!project) return
    try {
      await fetch(`/api/projects/${project.id}/rollback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pillId }),
      })
      await fetchPills()
      toast({ title: '已回滾到此藥丸' })
    } catch (err) {
      toast({ title: '回滾失敗', description: String(err), variant: 'destructive' })
    }
  }

  const handleDeletePill = async (pillId: string) => {
    if (!project) return
    try {
      await fetch(`/api/projects/${project.id}/pills/${pillId}`, { method: 'DELETE' })
      await fetchPills()
      toast({ title: '藥丸已丟棄' })
    } catch (err) {
      toast({ title: '刪除失敗', description: String(err), variant: 'destructive' })
    }
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-1" />
          返回
        </Button>
      </div>
    )
  }

  const currentPill = pills.find((p) => p.isCurrent)

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={onBack} variant="ghost" size="sm" className="text-stone-600">
          <ArrowLeft className="w-4 h-4 mr-1" />
          返回專案列表
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-2xl">{project.emoji}</span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-stone-800 truncate">{project.name}</h2>
            {project.description && (
              <p className="text-xs text-stone-500 truncate">{project.description}</p>
            )}
          </div>
        </div>
        <Dialog open={showApiHelp} onOpenChange={setShowApiHelp}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
              <Code2 className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">給 agent 用的 API</span>
              <span className="sm:hidden">API</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-600" />
                Agent API 端點
              </DialogTitle>
              <DialogDescription>
                讓你的 agent 程式透過這個端點撈現在的滾動記憶，注入到下次對話的 system prompt 開頭。
              </DialogDescription>
            </DialogHeader>
            <ApiHelpContent projectId={project.id} />
          </DialogContent>
        </Dialog>
      </div>

      {/* 煉丹介面 */}
      <RefineCard
        conversation={conversation}
        setConversation={setConversation}
        onRefine={handleRefine}
        refining={refining}
        hasPrevious={!!currentPill}
      />

      {/* 當前記憶卡 */}
      {loading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : currentPill ? (
        <CurrentMemoryCard project={project} pill={currentPill} />
      ) : (
        <NoMemoryCard />
      )}

      {/* 歷史 timeline */}
      {pills.length > 0 && (
        <HistoryTimeline
          pills={pills}
          onRollback={handleRollback}
          onDelete={handleDeletePill}
        />
      )}
    </div>
  )
}

function ApiHelpContent({ projectId }: { projectId: string }) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-app.example'
  const jsonUrl = `${baseUrl}/api/projects/${projectId}/memory`
  const textUrl = `${baseUrl}/api/projects/${projectId}/memory?format=text`

  return (
    <div className="space-y-3 py-2">
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500">JSON 格式（給程式 parse）</Label>
        <pre className="text-[11px] bg-stone-900 text-stone-100 rounded-lg p-3 overflow-x-auto">
          {`curl ${jsonUrl}`}
        </pre>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500">純文本格式（直接貼到 system prompt）</Label>
        <pre className="text-[11px] bg-stone-900 text-stone-100 rounded-lg p-3 overflow-x-auto">
          {`curl ${textUrl}`}
        </pre>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500">Python 範例</Label>
        <pre className="text-[11px] bg-stone-900 text-stone-100 rounded-lg p-3 overflow-x-auto">
{`import requests
mem = requests.get("${textUrl}").text
# 把 mem 貼到下次對話的 system prompt 開頭`}
        </pre>
      </div>
      <p className="text-xs text-stone-500 leading-relaxed">
        💡 在你的 agent 程式中，每次開新對話前先 fetch 這個端點，把回傳內容放到 system prompt 開頭即可。
        純文本格式已經排版好，可以直接貼；JSON 格式則適合你自己在程式中重新排版。
      </p>
    </div>
  )
}

function RefineCard({
  conversation,
  setConversation,
  onRefine,
  refining,
  hasPrevious,
}: {
  conversation: string
  setConversation: (v: string) => void
  onRefine: () => void
  refining: boolean
  hasPrevious: boolean
}) {
  const { toast } = useToast()
  const [tab, setTab] = useState<'paste' | 'url'>('paste')
  const [shareUrl, setShareUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMeta, setImportMeta] = useState<{ source: string; messageCount: number; title?: string } | null>(null)

  const handleImportUrl = async () => {
    if (!shareUrl.trim()) {
      toast({ title: '請貼分享連結', variant: 'destructive' })
      return
    }
    setImporting(true)
    setImportMeta(null)
    try {
      const res = await fetch(`/api/import-url?url=${encodeURIComponent(shareUrl.trim())}`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'import failed')
      }
      setConversation(data.conversationText)
      setImportMeta({
        source: data.source,
        messageCount: data.messageCount,
        title: data.title,
      })
      toast({
        title: `已從 ${data.source === 'chatgpt' ? 'ChatGPT' : data.source === 'claude' ? 'Claude' : '分享連結'} 抓取對話`,
        description: `${data.messageCount} 則訊息 · 已填入下方文本框，可檢視後再煉丹`,
      })
      // 切回貼上 tab 讓使用者看文本
      setTab('paste')
    } catch (err) {
      toast({
        title: '抓取失敗',
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Card className="border-amber-200 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-stone-800">
          <FlaskConical className="w-4 h-4 text-amber-600" />
          煉丹爐
          {hasPrevious && (
            <Badge variant="outline" className="ml-auto text-xs font-normal border-emerald-200 text-emerald-700 bg-emerald-50">
              <Sparkles className="w-3 h-3 mr-1" />
              會融合上一顆藥丸
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          把這次對話餵進來，按「煉丹」就會幫你萃取成記憶藥丸。可直接貼文本，也可貼 ChatGPT / Claude 的分享連結。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'paste' | 'url')}>
          <TabsList className="grid w-full grid-cols-2 max-w-sm">
            <TabsTrigger value="paste" className="text-xs">
              <MessageSquare className="w-3 h-3 mr-1" />
              貼對話文本
            </TabsTrigger>
            <TabsTrigger value="url" className="text-xs">
              <LinkIcon className="w-3 h-3 mr-1" />
              貼分享連結
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="mt-3 space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="https://chatgpt.com/share/...  或  https://claude.ai/share/..."
                value={shareUrl}
                onChange={(e) => setShareUrl(e.target.value)}
                className="text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !importing) handleImportUrl()
                }}
              />
              <Button
                onClick={handleImportUrl}
                disabled={importing || !shareUrl.trim()}
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-50 flex-shrink-0"
              >
                {importing ? (
                  <>
                    <GinkgoSpinning size={14} className="mr-1" />
                    抓取中…
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 mr-1" />
                    抓取
                  </>
                )}
              </Button>
            </div>
            <div className="text-[11px] text-stone-500 leading-relaxed space-y-1.5">
              <div className="flex items-start gap-1">
                <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>
                  在 ChatGPT/Claude 對話右上角找到「Share」按鈕 → 建立公開分享連結 → 貼到這裡。
                  抓回來的文本會填到「貼對話文本」tab 讓你檢視，確認後再按煉丹。
                </span>
              </div>
              <div className="flex items-start gap-1 text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                <span className="flex-shrink-0">⚠️</span>
                <span>
                  <b>已知限制：</b>ChatGPT 分享連結會被 Cloudflare 防護擋下（HTTP 403），
                  建議改用「貼對話文本」tab。Claude 分享連結在支援地區可正常抓取。
                  真正的「一鍵」需要 Chrome 擴充（會在你的瀏覽器中抓，繞過此限制）。
                </span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="paste" className="mt-3 space-y-2">
            {importMeta && (
              <div className="text-[11px] bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md px-2.5 py-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                已從 {importMeta.source === 'chatgpt' ? 'ChatGPT' : importMeta.source === 'claude' ? 'Claude' : '分享連結'} 抓取
                · {importMeta.messageCount} 則訊息
                {importMeta.title && <span className="text-emerald-600">· {importMeta.title}</span>}
              </div>
            )}
            <Textarea
              placeholder={`貼上對話全文。例如：\n\nUser: 我想做一個 CRUD app...\nAssistant: 好啊，要什麼 stack？\nUser: Next.js + Prisma\nAssistant: 那我建議...\n\n不用担心太長 — 越完整，藥丸越有效。`}
              rows={8}
              value={conversation}
              onChange={(e) => {
                setConversation(e.target.value)
                if (importMeta) setImportMeta(null) // 使用者改了文本，重設 import 標記
              }}
              className="resize-y text-sm leading-relaxed"
            />
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-stone-500">
            {conversation.length > 0 ? `${conversation.length} 字元` : '提示：可以包含 user/assistant 標記，但不是必須'}
          </p>
          <Button
            onClick={onRefine}
            disabled={refining || !conversation.trim()}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {refining ? (
              <>
                <GinkgoSpinning size={16} className="mr-1.5" />
                煉丹中…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-1.5" />
                煉丹
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function NoMemoryCard() {
  return (
    <Card className="border-dashed border-amber-200 bg-amber-50/30 relative overflow-hidden">
      <GinkgoRain count={5} />
      <CardContent className="py-10 text-center relative z-10">
        <div className="text-amber-600 mb-3 flex justify-center">
          <GinkgoLeaf size={40} />
        </div>
        <p className="text-stone-600 text-sm">這個專案還沒有藥丸</p>
        <p className="text-xs text-stone-400 mt-1">把上面的對話貼進煉丹爐，按「煉丹」就會生出第一顆</p>
      </CardContent>
    </Card>
  )
}

function CurrentMemoryCard({ project, pill }: { project: Project; pill: PillFull }) {
  const { toast } = useToast()
  const summary = pill.summary

  const handleCopy = () => {
    const text = formatMemoryCard(project.name, summary, pill.title ?? undefined)
    navigator.clipboard.writeText(text).then(
      () => toast({ title: '記憶卡已複製 🌿', description: '貼到下次對話的第一則訊息即可' }),
      () => toast({ title: '複製失敗', variant: 'destructive' }),
    )
  }

  return (
    <Card className="border-amber-200 bg-white shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-start gap-3 space-y-0">
        <div className="flex-1 min-w-0">
          <CardTitle className="flex items-center gap-2 text-stone-800">
            <GinkgoLeaf size={18} className="text-amber-600" />
            當前記憶卡
            <Badge variant="outline" className="ml-1 text-xs font-normal bg-amber-50 border-amber-200 text-amber-700">
              current
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs mt-1 truncate">
            {pill.title ?? '（無標題）'} · {new Date(pill.createdAt).toLocaleString('zh-TW')}
          </CardDescription>
        </div>
        <Button onClick={handleCopy} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Copy className="w-3.5 h-3.5 mr-1" />
          複製記憶卡
        </Button>
      </CardHeader>
      <CardContent>
        {isMemoryEmpty(summary) ? (
          <div className="py-6 text-center text-sm text-stone-400">
            這顆藥丸是空的 — LLM 沒有萃取出任何東西。可能對話內容太少？
          </div>
        ) : (
          <div className="space-y-4">
            <MemorySection
              icon="✅"
              title="已定案的決策"
              items={summary.decisions}
              color="emerald"
            />
            <MemorySection
              icon="⚠️"
              title="仍待討論的開放問題"
              items={summary.openQuestions}
              color="amber"
            />
            <MemorySectionAction items={summary.actionItems} />
            <MemorySection
              icon="🎯"
              title="背景錨點（不可遺忘）"
              items={summary.contextAnchors}
              color="stone"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function isMemoryEmpty(s: MemorySummary): boolean {
  return (
    s.decisions.length === 0 &&
    s.openQuestions.length === 0 &&
    s.actionItems.length === 0 &&
    s.contextAnchors.length === 0
  )
}

function MemorySection({
  icon,
  title,
  items,
  color,
}: {
  icon: string
  title: string
  items: string[]
  color: 'emerald' | 'amber' | 'stone'
}) {
  if (items.length === 0) return null
  const colorMap = {
    emerald: 'border-emerald-100 bg-emerald-50/40',
    amber: 'border-amber-100 bg-amber-50/40',
    stone: 'border-stone-200 bg-stone-50/60',
  }
  return (
    <div className={`rounded-xl border ${colorMap[color]} p-3`}>
      <div className="text-xs font-semibold text-stone-700 mb-2 flex items-center gap-1.5">
        <span>{icon}</span>
        {title}
        <span className="text-stone-400 font-normal">· {items.length}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-stone-700 leading-relaxed pl-1">
            <span className="text-stone-400 mr-1.5">{i + 1}.</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function MemorySectionAction({ items }: { items: ActionItem[] }) {
  if (items.length === 0) return null
  const statusIcon = (s: ActionItem['status']) => (s === 'done' ? '✓' : s === 'blocked' ? '✗' : '○')
  const statusColor = (s: ActionItem['status']) =>
    s === 'done'
      ? 'text-emerald-600'
      : s === 'blocked'
        ? 'text-red-500'
        : 'text-amber-600'
  return (
    <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-3">
      <div className="text-xs font-semibold text-stone-700 mb-2 flex items-center gap-1.5">
        <span>📋</span>
        行動項
        <span className="text-stone-400 font-normal">· {items.length}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-stone-700 leading-relaxed flex items-start gap-2 pl-1">
            <span className={`${statusColor(item.status)} font-bold mt-0.5 flex-shrink-0`}>
              {statusIcon(item.status)}
            </span>
            <span className="flex-1">
              {item.task}
              {item.owner && <span className="text-stone-400 ml-1.5 text-xs">— {item.owner}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function HistoryTimeline({
  pills,
  onRollback,
  onDelete,
}: {
  pills: PillFull[]
  onRollback: (pillId: string) => void
  onDelete: (pillId: string) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  return (
    <Card className="border-stone-200 bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-stone-800 text-base">
          <History className="w-4 h-4 text-stone-500" />
          藥丸歷史
          <Badge variant="outline" className="text-xs font-normal">{pills.length}</Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          點任一顆藥丸可展開看詳情，可「回滾」到那顆作為當前記憶。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[600px] pr-3">
          <div className="space-y-2">
            {pills.map((pill, idx) => {
              const isLast = idx === 0
              const isExpanded = expanded === pill.id
              return (
                <div
                  key={pill.id}
                  className={`rounded-xl border transition-all ${
                    pill.isCurrent
                      ? 'border-amber-300 bg-amber-50/60'
                      : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  <button
                    className="w-full text-left p-3 flex items-center gap-3"
                    onClick={() => setExpanded(isExpanded ? null : pill.id)}
                  >
                    <div className="flex-shrink-0">
                      <GinkgoLeaf
                        size={20}
                        className={pill.isCurrent ? 'text-amber-600' : 'text-stone-300'}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-stone-800 truncate">
                          {pill.title ?? '(無標題)'}
                        </span>
                        {pill.isCurrent && (
                          <Badge variant="outline" className="text-[10px] py-0 h-4 bg-amber-100 border-amber-300 text-amber-700">
                            current
                          </Badge>
                        )}
                        {isLast && !pill.isCurrent && (
                          <Badge variant="outline" className="text-[10px] py-0 h-4 bg-stone-100 text-stone-500">
                            latest
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {new Date(pill.createdAt).toLocaleString('zh-TW')}
                      </p>
                    </div>
                    <span className="text-xs text-stone-400 flex-shrink-0">
                      {isExpanded ? '收起' : '展開'}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-stone-100 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        <MemorySection icon="✅" title="決策" items={pill.summary.decisions} color="emerald" />
                        <MemorySection icon="⚠️" title="開放問題" items={pill.summary.openQuestions} color="amber" />
                        <MemorySection icon="🎯" title="背景錨點" items={pill.summary.contextAnchors} color="stone" />
                        <MemorySectionAction items={pill.summary.actionItems} />
                      </div>
                      <details className="text-xs">
                        <summary className="cursor-pointer text-stone-500 hover:text-stone-700">
                          查看原始對話文本
                        </summary>
                        <pre className="mt-2 bg-stone-50 rounded-lg p-3 text-[11px] whitespace-pre-wrap max-h-60 overflow-y-auto text-stone-600">
                          {pill.conversationText}
                        </pre>
                      </details>
                      <div className="flex items-center gap-2 pt-2">
                        {!pill.isCurrent && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onRollback(pill.id)}
                            className="border-amber-200 text-amber-700 hover:bg-amber-50"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            回滾為當前
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                              <Trash2 className="w-3 h-3 mr-1" />
                              刪除
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>刪除這顆藥丸？</AlertDialogTitle>
                              <AlertDialogDescription>
                                刪除後無法復原。如果刪的是 current，會自動把前一顆設為 current。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onDelete(pill.id)}
                                className="bg-red-500 hover:bg-red-600"
                              >
                                刪除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
