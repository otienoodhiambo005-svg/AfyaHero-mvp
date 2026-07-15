$file = "DawaChat.tsx"
$content = Get-Content $file -Raw

# Change flex-col to flex-row
$content = $content -replace 'flex h-full flex-col bg-transparent font-sans', 'flex h-full flex-row bg-transparent font-sans'

# Add sidebar toggle button
$content = $content -replace '<div className="flex items-center gap-3">\n          <div className="w-10 h-10 rounded-xl bg-emerald/10 border border-emerald/20 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.1)]">', '<div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-lg transition-all text-mist/60 hover:text-white"
            type="button"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-emerald/10 border border-emerald/20 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.1)]">'

# Add DawaChatSidebar component and wrapper
$content = $content -replace 'return \(\n    <div className="flex h-full flex-row bg-transparent font-sans">\n      \{/\* Premium Header \*/\}', "return (
    <div className=""flex h-full flex-row bg-transparent font-sans"">
      <DawaChatSidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onStartNewChat={startNewChat}
        onLoadConversation={loadConversation}
        onDeleteConversation={deleteConversation}
      />
      <div className=""flex-1 flex flex-col"">
      {/* Premium Header */}"

# Add closing div for wrapper
$content = $content -replace '      </div>\n    </div>\n  \);', '      </div>
      </div>
    </div>
  );'

$content | Set-Content $file -NoNewline
Write-Host "JSX changes applied successfully"
