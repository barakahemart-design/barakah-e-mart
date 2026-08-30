import os

with open('src/App.tsx', 'rb') as f:
    raw_lines = f.readlines()

clean_lines = raw_lines[:9583]
clean_text = b''.join(clean_lines).decode('utf-8')

modal_category_code = """
      {/* ADD NEW CATEGORY MODAL */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-[60] bg-[#0c0c0e]/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E1E24] rounded-2xl border border-slate-800 shadow-2xl overflow-hidden max-w-sm w-full p-5 space-y-4 text-slate-200 animate-scaleIn" id="modal-add-category">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <h3 className="text-xs font-extrabold uppercase text-[#00E676] flex items-center gap-2 font-display">
                <Tag className="w-4 h-4 text-emerald-400" />
                Add New Expense Category
              </h3>
              <button 
                onClick={() => {
                  setCategoryModalOpen(false);
                  setNewCategoryName("");
                  setCategoryModalTarget(null);
                }} 
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = newCategoryName.trim();
                if (!trimmed) return;
                if (!expenseCategories.includes(trimmed)) {
                  setExpenseCategories(prev => [...prev, trimmed]);
                }
                if (categoryModalTarget === "edit") {
                  setEditExpenseCategory(trimmed);
                } else {
                  setExpenseCategory(trimmed);
                }
                setNewCategoryName("");
                setCategoryModalOpen(false);
                setCategoryModalTarget(null);
                triggerNotification(`Category "${trimmed}" added!`, "success");
              }}
              className="space-y-4 text-xs font-sans"
            >
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold block">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Utility, Transport, Equipment"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500 font-sans"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-3 pt-2 font-sans">
                <button
                  type="submit"
                  className="flex-1 py-1 px-4 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold text-xs rounded-xl h-10 transition-all cursor-pointer shadow-lg shadow-emerald-600/10 text-center uppercase tracking-wider"
                >
                  Create Category
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryModalOpen(false);
                    setNewCategoryName("");
                    setCategoryModalTarget(null);
                  }}
                  className="flex-1 py-1 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl h-10 transition-all cursor-pointer text-center uppercase tracking-wider"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
"""

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(clean_text + modal_category_code)

print("Finished fixing App.tsx successfully.")
