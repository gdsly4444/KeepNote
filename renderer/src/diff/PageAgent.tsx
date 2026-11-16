import type { DocumentType, Proposal } from '../../../shared'
import './diff.css'

const names: Record<DocumentType, string> = {
  work: '工作记录',
  essay: '长文',
  journal: '日记',
  list: '清单',
  tech: '技术笔记'
}

const actions = ['缩短', '改写', '译成中文', '做成摘录'] as const

export function PageAgent({
  type,
  selection,
  proposal,
  onApply,
  onDiscard,
  onAsk
}: {
  type: DocumentType
  selection: string
  proposal: Proposal | null
  onApply: (groupId?: string) => void
  onDiscard: () => void
  onAsk: (text: string, selection: string) => void
}) {
  const chosen = selection.trim()
  return (
    <div className="page-agent">
      {type !== 'list' && chosen ? (
        <div className="selection-bar">
          {actions.map((label) => (
            <button key={label} className="control" type="button" onClick={() => onAsk(`${label}：${chosen}`, chosen)}>
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {proposal && proposal.groups.length > 0 ? (
        <div className="diff-list">
          <p className="diff-path">{proposal.path}</p>
          {proposal.groups.map((group) => (
            <article key={group.id} className="diff-card" data-unit={group.unit}>
              {group.before ? <p className="diff-old">{group.before}</p> : null}
              <p className="diff-new">{group.after}</p>
              <button className="control" type="button" onClick={() => onApply(group.id)}>
                接受
              </button>
            </article>
          ))}
          <button className="control" type="button" onClick={() => onApply()}>
            全部接受
          </button>
          <button className="control" type="button" onClick={onDiscard}>
            放弃
          </button>
        </div>
      ) : null}
      {proposal?.conversion ? (
        <p className="diff-conversion">
          提议转换成{names[proposal.conversion.to]}，先不写入。{proposal.conversion.preview}
        </p>
      ) : null}
    </div>
  )
}
