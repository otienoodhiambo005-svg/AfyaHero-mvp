const fs = require('fs');

const filePath = 'DawaChat.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Change flex-col to flex-row in main container
content = content.replace(
  'flex h-full flex-col bg-transparent font-sans',
  'flex h-full flex-row bg-transparent font-sans'
);

// Add sidebar toggle button to header
content = content.replace(
  '<div className="flex items-center gap-3">\n          <div className="w-10 h-10 rounded-xl bg-emerald/10 border border-emerald/20 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.1)]">',
  '<div className="flex items-center gap-3">\n          <button\n            onClick={() => setSidebarOpen(!sidebarOpen)}\n            className="p-2 hover:bg-white/10 rounded-lg transition-all text-mist/60 hover:text-white"\n            type="button"\n          >\n            <PanelLeft className="w-5 h-5" />\n          </button>\n          <div className="w-10 h-10 rounded-xl bg-emerald/10 border border-emerald/20 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.1)]">'
);

// Add DawaChatSidebar component and wrap content
content = content.replace(
  'return (\n    <div className="flex h-full flex-row bg-transparent font-sans">\n      {/* Premium Header */}',
  `return (
    <div className="flex h-full flex-row bg-transparent font-sans">
      <DawaChatSidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onStartNewChat={startNewChat}
        onLoadConversation={loadConversation}
        onDeleteConversation={deleteConversation}
      />
      <div className="flex-1 flex flex-col">
      {/* Premium Header */}`
);

// Add closing div for content wrapper before final closing div
content = content.replace(
  '      </div>\n    </div>\n  );\n}',
  '      </div>\n      </div>\n    </div>\n  );\n'
);

fs.writeFileSync(filePath, content);
console.log('JSX sidebar changes applied successfully');
