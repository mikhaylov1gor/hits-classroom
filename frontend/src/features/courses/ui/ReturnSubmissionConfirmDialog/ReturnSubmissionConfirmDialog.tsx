import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material'

type ReturnSubmissionConfirmDialogProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  studentName: string
  loading?: boolean
}

export function ReturnSubmissionConfirmDialog({
  open,
  onClose,
  onConfirm,
  studentName,
  loading = false,
}: ReturnSubmissionConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Вернуть задание на доработку?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Работа студента {studentName} будет возвращена на доработку.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Отмена
        </Button>
        <Button onClick={onConfirm} variant="contained" color="secondary" disabled={loading}>
          {loading ? 'Возврат…' : 'Вернуть'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
