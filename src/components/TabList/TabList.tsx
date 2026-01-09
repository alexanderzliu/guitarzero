import type { TabMetadata } from '../../lib/storage/tabStorage';

interface TabListProps {
  tabs: TabMetadata[];
  onSelectTab: (id: string) => void;
  onImportTab: () => void;
}

export function TabList({ tabs, onSelectTab, onImportTab }: TabListProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-200">Tab Library</h2>
        <span className="text-xs text-slate-500">
          {tabs.length} {tabs.length === 1 ? 'tab' : 'tabs'}
        </span>
      </div>

      {tabs.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-slate-500 mb-4">
            <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <p>No tabs imported yet</p>
          </div>
          <button
            onClick={onImportTab}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Import Your First Tab
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {tabs.map((tab) => (
            <TabListItem key={tab.id} tab={tab} onClick={() => onSelectTab(tab.id)} />
          ))}

          <button
            onClick={onImportTab}
            className="w-full py-2 px-4 border border-dashed border-slate-600 hover:border-slate-500 text-slate-400 hover:text-slate-300 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Import Tab
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
      className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-left transition-colors group"
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-white font-medium truncate">{tab.title}</div>
          <div className="text-slate-400 text-sm truncate">{tab.artist || 'Unknown Artist'}</div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-slate-500 text-xs">{formattedDate}</span>
          <svg
            className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors"
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
