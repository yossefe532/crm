import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { coreService } from "../../lib/services/coreService"
import { useAuth } from "../../lib/auth/AuthContext"
import { Modal } from "../ui/Modal"
import { Button } from "../ui/Button"
import { Select } from "../ui/Select"
import { toast } from "react-hot-toast"
import { AlertTriangle } from "lucide-react"

interface DemoteTeamLeaderModalProps {
  isOpen: boolean
  onClose: () => void
  leaderId: string
  leaderName: string
  teamId?: string // Optional, if we want to pre-select or filter
  availableUsers: { id: string; name: string; email: string; roles: string[] }[]
}

export const DemoteTeamLeaderModal = ({ 
  isOpen, 
  onClose, 
  leaderId, 
  leaderName,
  availableUsers 
}: DemoteTeamLeaderModalProps) => {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const [newLeaderId, setNewLeaderId] = useState<string>("")

  const demoteMutation = useMutation({
    mutationFn: () => coreService.demoteTeamLeader(leaderId, { newLeaderId: newLeaderId || undefined }, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      toast.success(`تم تنحية ${leaderName} بنجاح`)
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "حدث خطأ أثناء التنحية")
    }
  })

  // Filter potential leaders:
  // 1. Not the current leader
  // 2. Not already a team leader (unless we want to allow swapping? No, backend forbids it)
  // 3. Not owner (backend handles owner assignment if no ID provided)
  const potentialLeaders = availableUsers.filter(u => 
    u.id !== leaderId && 
    !u.roles.includes("team_leader") && 
    !u.roles.includes("owner")
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="تنحية قائد الفريق">
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold mb-1">تحذير هام</p>
            <p>سيتم إزالة صلاحيات &quot;قائد فريق&quot; من <strong>{leaderName}</strong> وتحويله إلى عضو عادي.</p>
            <p className="mt-2">يجب تعيين قائد جديد للفريق، أو سيتم تعيين المالك كقائد مؤقت.</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">القائد الجديد (اختياري)</label>
          <Select 
            value={newLeaderId} 
            onChange={(e) => setNewLeaderId(e.target.value)}
            className="w-full"
          >
            <option value="">-- تعيين المالك كقائد مؤقت --</option>
            {potentialLeaders.map(user => (
              <option key={user.id} value={user.id}>
                {user.name || user.email}
              </option>
            ))}
          </Select>
          <p className="text-xs text-gray-500">
            إذا لم تختر قائداً جديداً، سيتم تعيين المالك كقائد للفريق مؤقتاً.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={onClose} disabled={demoteMutation.isPending}>
            إلغاء
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => demoteMutation.mutate()} 
            isLoading={demoteMutation.isPending}
          >
            تأكيد التنحية
          </Button>
        </div>
      </div>
    </Modal>
  )
}
