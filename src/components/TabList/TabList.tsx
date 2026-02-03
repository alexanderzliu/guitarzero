import type { TabMetadata } from '../../lib/storage/tabStorage';

// ============================================================================
// Tab List - "Garage Film" Aesthetic
// ============================================================================

interface TabListProps {
  tabs: TabMetadata[];
  onSelectTab: (id: string) => void;
  onImportTab: () => void;
}

export function TabList({ tabs, onSelectTab, onImportTab }: TabListProps) {
  return (
    <div className="bg-[#1a1614] border border-[#292524] rounded p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl text-[#f5f0e6] tracking-wide">TAB LIBRARY</h2>
        <span className="text-xs text-[#57534e] font-mono">
          {tabs.length} {tabs.length === 1 ? 'TAB' : 'TABS'}
        </span>
      </div>

      {tabs.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-[#57534e] mb-4">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <p className="text-sm">No tabs imported yet</p>
          </div>
          <button
            onClick={onImportTab}
            className="px-5 py-3 bg-[#dc2626] hover:bg-[#ef4444] text-[#f5f0e6] rounded font-display tracking-wide text-sm transition-all hover:shadow-[0_0_20px_rgba(220,38,38,0.5)]"
          >
            IMPORT YOUR FIRST TAB
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {tabs.map((tab) => (
            <TabListItem key={tab.id} tab={tab} onClick={() => onSelectTab(tab.id)} />
          ))}

          <button
            onClick={onImportTab}
            className="w-full py-3 px-4 border border-dashed border-[#292524] hover:border-[#dc2626] text-[#78716c] hover:text-[#f5f0e6] rounded text-sm transition-all flex items-center justify-center gap-2 font-display tracking-wide hover:shadow-[0_0_10px_rgba(220,38,38,0.2)]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            IMPORT TAB
          </button>
        </div>
      )}
    </div>
  );
}

interface TabListItemProps {
  tab: TabMetadata;
  onClick: () => void;
}

function TabListItem({ tab, onClick }: TabListItemProps) {
  const formattedDate = new Date(tab.createdAt).toLocaleDateString();

  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3 bg-[#0a0a0a] hover:bg-[#292524] border border-[#292524] hover:border-[#dc2626] rounded text-left transition-all group"
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-[#f5f0e6] font-semibold truncate">{tab.title}</div>
          <div className="text-[#78716c] text-sm truncate">{tab.artist || 'Unknown Artist'}</div>
        </div>
        <div className="flex items-center gap-3 ml-4">
          <span className="text-[#57534e] text-xs font-mono">{formattedDate}</span>
          <svg
            className="w-4 h-4 text-[#57534e] group-hover:text-[#dc2626] transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
}
