<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Portfolio Manager</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Inter:wght@400;500;600;800&display=swap" rel="stylesheet">
    
    <style>
        /* --- DESIGN SYSTEM: SOFT NEO-BRUTALISM --- */
        :root {
            --bg-main: #fdfbf7;
            --bg-card: #ffffff;
            --border-color: #18181b;
            --shadow-color: #18181b;
            --accent-yellow: #facc15;
            --accent-green: #10b981;
            --accent-red: #f43f5e;
            --accent-orange: #fb923c;
            --accent-purple: #a855f7;
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-main);
            color: #18181b;
            background-image: radial-gradient(#e5e7eb 1px, transparent 1px);
            background-size: 24px 24px;
        }

        h1, h2, h3, h4, h5, .font-display {
            font-family: 'Space Grotesk', sans-serif;
        }

        /* --- UTILS --- */
        .card {
            background-color: var(--bg-card);
            border: 2px solid var(--border-color);
            border-radius: 0.5rem;
            box-shadow: 4px 4px 0px 0px var(--shadow-color);
            padding: 1.5rem;
            transition: transform 0.1s ease-in-out;
            margin-bottom: 1.5rem;
        }
        /* Reset margin bottom di desktop grid layout agar dikontrol oleh gap grid */
        @media (min-width: 1024px) {
            .card { margin-bottom: 0; }
        }

        .card:hover { transform: translate(-1px, -1px); box-shadow: 6px 6px 0px 0px var(--shadow-color); }

        .btn {
            font-family: 'Space Grotesk', sans-serif;
            font-weight: 700;
            padding: 0.6em 1.5em;
            border: 2px solid var(--border-color);
            border-radius: 0.375rem;
            box-shadow: 2px 2px 0px 0px var(--shadow-color);
            transition: all 0.15s ease;
            text-transform: uppercase;
            font-size: 0.875rem;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        .btn:hover { transform: translate(-2px, -2px); box-shadow: 4px 4px 0px 0px var(--shadow-color); }
        .btn:active { transform: translate(2px, 2px); box-shadow: 0px 0px 0px 0px var(--shadow-color); }

        .btn-primary { background-color: var(--border-color); color: #ffffff; }
        .btn-primary:hover { background-color: #27272a; }
        .btn-secondary { background-color: #ffffff; color: var(--border-color); }
        .btn-secondary:hover { background-color: #f3f4f6; }
        .btn-accent { background-color: var(--accent-yellow); color: var(--border-color); }
        .btn-danger { background-color: var(--accent-red); color: white; border-color: #881337; }
        .btn-developer { background-color: var(--accent-purple); color: white; border-color: #581c87; }

        input, select, textarea {
            display: block; width: 100%; padding: 0.75rem 1rem;
            font-family: 'Inter', sans-serif; font-weight: 600; font-size: 1rem;
            color: #18181b; background-color: #ffffff;
            border: 2px solid var(--border-color); border-radius: 0.5rem;
            transition: all 0.2s;
        }
        input:focus, select:focus, textarea:focus {
            outline: none; border-color: var(--border-color);
            background-color: #ffffff; box-shadow: 4px 4px 0px 0px var(--accent-yellow);
            transform: translate(-2px, -2px);
        }
        label {
            display: block; font-family: 'Space Grotesk', sans-serif;
            font-weight: 700; font-size: 0.75rem; text-transform: uppercase;
            letter-spacing: 0.05em; margin-bottom: 0.5rem; color: #18181b;
        }

        /* --- TABS & NAVBAR --- */
        #tab-nav-wrapper.sticky-state {
            position: fixed; top: 1rem; left: 50%; transform: translateX(-50%);
            width: calc(100% - 2rem); max-width: 1280px; z-index: 50;
        }
        .tab-nav-container {
            background: white; border: 2px solid var(--border-color); border-radius: 0.5rem;
            padding: 0.5rem; box-shadow: 4px 4px 0px 0px rgba(0,0,0,0.1);
            overflow-x: auto; display: flex; gap: 0.5rem;
            transition: background-color 0.3s ease, backdrop-filter 0.3s ease;
        }
        #tab-nav-wrapper.sticky-state .tab-nav-container {
            background-color: rgba(253, 251, 247, 0.65); backdrop-filter: blur(12px);
            box-shadow: 4px 4px 0px 0px rgba(24, 24, 27, 0.1);
        }
        .tab-button {
            padding: 0.5rem 1rem; border: 2px solid transparent; border-radius: 0.25rem;
            font-weight: 600; color: #6b7280; white-space: nowrap; transition: all 0.2s;
            flex-grow: 1; text-align: center;
        }
        .tab-button:hover { color: var(--border-color); background-color: #f3f4f6; }
        .tab-button.active {
            background-color: var(--accent-yellow); color: var(--border-color);
            border: 2px solid var(--border-color); box-shadow: 2px 2px 0px 0px var(--border-color);
            transform: translate(-1px, -1px);
        }
        /* Specific style for Developer tab when active */
        #tab-btn-developer.active {
            background-color: var(--accent-purple); color: white;
            border-color: #581c87;
        }

        /* --- TABLES --- */
        .table-brutal {
            width: 100%; border-collapse: separate; border-spacing: 0;
            border: 2px solid var(--border-color); border-radius: 0.5rem;
            overflow: hidden; background: white;
        }
        .table-brutal thead tr { background-color: #f3f4f6; border-bottom: 2px solid var(--border-color); }
        .table-brutal th {
            text-transform: uppercase; font-size: 0.75rem; font-weight: 700;
            padding: 1rem; text-align: left; border-bottom: 2px solid var(--border-color); color: #374151;
            user-select: none;
        }
        .table-brutal td { padding: 1rem; border-bottom: 1px solid #e5e7eb; color: #1f2937; }
        .table-brutal tr:last-child td { border-bottom: none; }
        .table-brutal tr:hover td { background-color: #fffbeb; }
        
        th.sortable { cursor: pointer; transition: background-color 0.2s; }
        th.sortable:hover { background-color: #e5e7eb; }
        .sort-icon { display: inline-block; margin-left: 4px; font-size: 0.7em; opacity: 0.3; }
        th.active-sort .sort-icon { opacity: 1; color: var(--border-color); }

        /* --- PAGINATION --- */
        .pagination-btn {
            font-family: 'Space Grotesk', sans-serif; font-weight: 700;
            display: inline-flex; align-items: center; justify-content: center;
            min-width: 2.5rem; height: 2.5rem; padding: 0 0.75rem;
            border: 2px solid var(--border-color); background-color: white; color: var(--primary);
            border-radius: 0.375rem; box-shadow: 2px 2px 0px 0px var(--border-color);
            cursor: pointer; transition: all 0.15s ease; margin: 0 0.25rem;
        }
        .pagination-btn:hover:not(:disabled) {
            transform: translate(-2px, -2px); box-shadow: 4px 4px 0px 0px var(--border-color); background-color: #f3f4f6;
        }
        .pagination-btn.active {
            background-color: var(--primary); color: white;
            transform: translate(1px, 1px); box-shadow: 1px 1px 0px 0px var(--border-color); cursor: default;
        }
        .pagination-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: 1px 1px 0px 0px var(--border-color); background-color: #e5e7eb; }

        /* --- MODALS & OVERLAYS --- */
        .modal-overlay {
            position: fixed; inset: 0; background-color: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center;
            z-index: 100; opacity: 0; visibility: hidden; transition: all 0.3s;
        }
        .modal-overlay.active { opacity: 1; visibility: visible; }

        .modal-content {
            background: white; border: 3px solid var(--border-color);
            box-shadow: 8px 8px 0px 0px var(--border-color); border-radius: 0.75rem;
            padding: 2.5rem; width: 95%; max-width: 600px; max-height: 90vh; overflow-y: auto;
        }

        /* --- LOGIN WALL OVERLAY --- */
        #login-wall-overlay {
            background-color: #e0e7ff;
            background-image: radial-gradient(#94a3b8 1px, transparent 1px);
            background-size: 24px 24px;
            z-index: 9999;
            opacity: 1;
            visibility: visible;
            transition: all 0.5s ease-out;
        }
        
        #login-wall-overlay.hidden-wall {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
        }

        .badge {
            display: inline-block; padding: 0.25rem 0.75rem;
            border: 1px solid var(--border-color); border-radius: 99px;
            font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
        }
        .badge-open { background-color: #dbeafe; color: #1e40af; border-color: #1e40af; }
        .badge-closed { background-color: #f3f4f6; color: #374151; border-color: #374151; }

        .tab-content { display: none; }
        .tab-content.active { display: block; animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        
        .accordion-arrow { transition: transform 0.3s ease; }
        .accordion-arrow.rotate-180 { transform: rotate(180deg); }
    </style>
</head>
<body class="pb-20">

    <!-- === LOGIN WALL OVERLAY === -->
    <div id="login-wall-overlay" class="fixed inset-0 flex items-center justify-center p-4">
        <div class="relative w-full max-w-md bg-yellow-400 border-[5px] border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-8 text-center overflow-hidden">
            <div class="absolute top-8 -left-12 bg-black text-white py-2 px-16 -rotate-45 font-bold text-xs tracking-[0.3em] border-y-2 border-white/30 shadow-md z-10">SECURE AREA</div>
            <div class="absolute top-4 -right-6 bg-black text-white py-1 px-10 rotate-12 font-bold text-[10px] tracking-widest border border-white/30 z-0 opacity-80">NO ACCESS</div>
            <div class="inline-block bg-black text-white px-4 py-1.5 font-black transform -rotate-1 mb-8 mt-4 text-sm tracking-widest border-2 border-transparent shadow-[2px_2px_0px_0px_white]">GAME COLLECTION</div>
            <h1 class="text-6xl font-black mb-2 tracking-tighter text-black uppercase leading-[0.85] drop-shadow-sm">AREA<br>TERBATAS</h1>
            <div class="w-24 h-2 bg-black mx-auto mb-4 mt-2"></div>
            <p class="font-bold text-black mb-10 text-sm uppercase tracking-wider">Silakan identifikasi diri anda</p>
            <button id="overlay-login-btn" class="w-full bg-white text-black font-black text-lg py-4 border-[3px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-3 group relative overflow-hidden">
                <div class="absolute inset-0 bg-gray-100 transform translate-y-full group-hover:translate-y-0 transition-transform duration-200 z-0"></div>
                <svg class="w-7 h-7 relative z-10" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span class="relative z-10 tracking-tight">MASUK DENGAN GOOGLE</span>
            </button>
        </div>
    </div>

    <div class="container mx-auto p-4 md:p-8 max-w-7xl">
        <!-- Header -->
        <header class="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 class="text-4xl md:text-5xl font-black tracking-tight text-gray-900 mb-2">PORTFOLIO<span class="text-yellow-500">.</span>MANAGER</h1>
                <p class="text-gray-600 font-medium border-l-4 border-yellow-400 pl-3">Simulate. Track. Analyze. Grow.</p>
            </div>
            
            <div class="flex flex-col items-end gap-2">
                 <div id="auth-container" class="flex items-center gap-3">
                    <span id="sync-status" class="text-xs font-bold text-gray-500 uppercase tracking-wide opacity-0 transition-opacity">Syncing...</span>
                    <div id="user-info" class="hidden items-center gap-3 bg-white border-2 border-black rounded-full px-4 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span id="user-name" class="font-bold text-sm truncate max-w-[100px]">User</span>
                        <button id="logout-btn" class="text-xs font-bold text-red-500 hover:underline">LOGOUT</button>
                    </div>
                    <button id="login-btn" class="btn btn-primary py-2 text-sm hidden">Login Google</button>
                </div>
            </div>
        </header>

        <!-- Sticky Navigation -->
        <div id="tab-nav-wrapper" class="mb-8 z-40">
            <nav class="tab-nav-container">
                <button id="tab-btn-simulator" class="tab-button active">Kalkulator</button>
                <button id="tab-btn-open-order" class="tab-button">Open Order</button>
                <button id="tab-btn-log" class="tab-button">Jurnal Transaksi</button>
                <button id="tab-btn-saved" class="tab-button">Simulasi</button>
                <button id="tab-btn-performance" class="tab-button">Performa</button>
                <button id="tab-btn-settings" class="tab-button">Settings</button>
                <button id="tab-btn-developer" class="tab-button bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-200">Developer</button>
            </nav>
        </div>

        <!-- CONTENT AREA -->
        <main>
            <!-- 1. TAB SIMULATOR -->
            <div id="tab-content-simulator" class="tab-content active">
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="lg:col-span-3">
                        <div class="card bg-yellow-50 border-yellow-400">
                            <div class="flex justify-between items-center mb-4">
                                <h2 class="text-xl font-bold flex items-center gap-2"><span class="w-3 h-3 bg-black rounded-full"></span>SIMULASI AKTIF</h2>
                                <button id="open-sim-params-modal-btn" class="btn btn-primary text-xs">Ubah Parameter</button>
                            </div>
                            <div id="active-sim-params-display" class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm font-mono"></div>
                        </div>
                    </div>
                    <div class="lg:col-span-3">
                        <div class="card">
                            <h2 class="text-2xl font-bold mb-6">Skenario Averaging</h2>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div class="border-2 border-gray-200 p-4 rounded bg-gray-50">
                                    <div class="text-gray-500 text-xs font-bold uppercase">Total Investasi</div>
                                    <div id="summary-total-investment" class="text-2xl font-bold text-gray-900">IDR 0</div>
                                </div>
                                <div class="border-2 border-gray-200 p-4 rounded bg-gray-50">
                                    <div class="text-gray-500 text-xs font-bold uppercase">Total Lot</div>
                                    <div id="summary-total-lot" class="text-2xl font-bold text-gray-900">0</div>
                                </div>
                                <div class="border-2 border-gray-200 p-4 rounded bg-yellow-100 border-yellow-300">
                                    <div class="text-yellow-800 text-xs font-bold uppercase">Harga Rata-Rata (Avg)</div>
                                    <div id="summary-avg-price" class="text-2xl font-bold text-yellow-900">IDR 0</div>
                                </div>
                            </div>
                            <div class="overflow-x-auto">
                                <table class="table-brutal">
                                    <thead>
                                        <tr>
                                            <th>Level</th><th>Harga Beli</th><th>Lot</th><th>Total Beli</th><th>Yield</th><th>Avg Price</th><th>TP 1</th><th>TP 2</th>
                                        </tr>
                                    </thead>
                                    <tbody id="scenario-table-body"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div id="simulation-reason-card" class="lg:col-span-3 card hidden bg-blue-50 border-blue-200">
                        <h3 class="font-bold text-blue-900 text-sm mb-2 uppercase">Catatan Strategi</h3>
                        <p id="simulation-reason-display" class="text-blue-800 italic"></p>
                    </div>
                </div>
            </div>

            <!-- 2. TAB OPEN ORDER -->
            <div id="tab-content-open-order" class="tab-content">
                <div class="card bg-blue-50 border-blue-200 mb-6">
                     <h2 class="text-2xl font-bold mb-4 text-blue-900">Open Order / Holdings</h2>
                     <p class="text-sm text-blue-800 mb-0">Berikut adalah ringkasan posisi saham Anda yang masih terbuka.</p>
                </div>
                <div id="portfolio-summary-by-stock" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6"></div>
            </div>

            <!-- 3. TAB LOG -->
            <div id="tab-content-log" class="tab-content">
                <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    
                    <!-- SIDEBAR -->
                    <div class="lg:col-span-1 space-y-6 lg:sticky lg:top-24 self-start h-fit z-30">
                        <div class="card">
                            <div class="flex justify-between items-center mb-2 lg:mb-4 border-b-2 border-gray-200 pb-2 cursor-pointer lg:cursor-default" id="toggle-summary-btn">
                                <h3 class="text-lg font-bold">Ringkasan</h3>
                                <span id="arrow-summary" class="lg:hidden text-xl font-bold transform transition-transform">▼</span>
                            </div>
                            <div id="summary-content" class="space-y-4">
                                <div>
                                    <label class="text-xs uppercase text-gray-500">Modal Awal</label>
                                    <input type="number" id="initial-equity" value="100000000" class="text-right font-mono font-bold text-lg">
                                </div>
                                <div class="bg-gray-100 p-3 rounded border-2 border-gray-200">
                                    <div class="text-xs text-gray-500">Cash Tersedia</div>
                                    <div id="current-equity-display" class="text-xl font-bold text-emerald-600">IDR 0</div>
                                </div>
                                <div id="realized-pl-summary"></div>
                                <div id="floating-pl-summary"></div>
                            </div>
                        </div>

                        <div class="card">
                            <div class="flex justify-between items-center mb-2 lg:mb-4 cursor-pointer lg:cursor-default" id="toggle-filter-btn">
                                <h3 class="text-lg font-bold">Filter</h3>
                                <span id="arrow-filter" class="lg:hidden text-xl font-bold transform transition-transform">▼</span>
                            </div>
                            <div id="filter-content" class="space-y-3">
                                <input type="text" id="filter-stock-code" placeholder="Kode Saham (e.g. BBCA)">
                                <div class="grid grid-cols-2 gap-2"><input type="date" id="filter-date-from" class="text-xs"><input type="date" id="filter-date-to" class="text-xs"></div>
                                <select id="filter-status"><option value="all">Semua Status</option><option value="open">Masih Open</option><option value="closed">Sudah Jual</option></select>
                                <input type="text" id="filter-reason" placeholder="Cari alasan...">
                                <div class="flex gap-2 pt-2"><button id="filter-apply-btn" class="btn btn-primary flex-1 text-xs">Apply</button><button id="filter-reset-btn" class="btn btn-secondary flex-1 text-xs">Reset</button></div>
                            </div>
                        </div>
                    </div>

                    <!-- Main Content -->
                    <div class="lg:col-span-3">
                        <div class="card min-h-[500px]">
                            <div class="flex justify-between items-center mb-6">
                                <h2 class="text-2xl font-bold">Jurnal Transaksi</h2>
                                <button id="open-add-log-modal-btn" class="btn btn-accent shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-black">+ Tambah</button>
                            </div>
                            <div class="hidden md:block overflow-x-auto">
                                <table class="table-brutal text-sm">
                                    <thead>
                                        <tr>
                                            <th class="sortable" data-col="date">Tgl <span class="sort-icon">▼</span></th>
                                            <th class="sortable" data-col="code">Kode <span class="sort-icon">▼</span></th>
                                            <th class="text-right sortable" data-col="price">Harga <span class="sort-icon">▼</span></th>
                                            <th class="text-right sortable" data-col="lot">Lot <span class="sort-icon">▼</span></th>
                                            <th class="text-center sortable" data-col="status">Stat <span class="sort-icon">▼</span></th>
                                            <th class="text-right sortable" data-col="pl">P/L <span class="sort-icon">▼</span></th>
                                            <th class="text-center">Act</th>
                                        </tr>
                                    </thead>
                                    <tbody id="log-table-body"></tbody>
                                </table>
                            </div>
                            <div id="log-card-view" class="md:hidden space-y-4"></div>
                            <div class="mt-6 flex flex-col md:flex-row justify-between items-center pt-4 border-t-2 border-gray-100 gap-4">
                                <div id="page-info" class="pagination-info"></div>
                                <div id="page-number-container" class="flex items-center gap-1 flex-wrap justify-center"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 4. TAB SAVED -->
            <div id="tab-content-saved" class="tab-content">
                <div class="card">
                    <h2 class="text-2xl font-bold mb-6">Simulasi Tersimpan</h2>
                    <div class="overflow-x-auto">
                        <table class="table-brutal">
                            <thead><tr><th>Saham</th><th>Harga Awal</th><th>Lot</th><th>Strategi</th><th>Avg Down</th><th>Level</th><th>Action</th></tr></thead>
                            <tbody id="saved-simulations-table-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- 5. TAB PERFORMANCE -->
            <div id="tab-content-performance" class="tab-content">
                <div class="card">
                    <h2 class="text-2xl font-bold mb-4">Analisa Performa</h2>
                    
                    <!-- UPDATED: Changed from grid lg:grid-cols-2 to space-y-8 for vertical layout -->
                    <div class="grid grid-cols-1 gap-8 mb-8">
                        <!-- Chart 1: Returns -->
                        <div>
                            <h3 class="text-sm font-bold text-gray-500 uppercase mb-2">Return vs Benchmark</h3>
                            <div class="h-[300px] w-full bg-gray-50 border-2 border-gray-200 rounded p-2">
                                <canvas id="performanceChart"></canvas>
                            </div>
                        </div>
                        <!-- Chart 2: Equity Growth (NEW) -->
                        <div>
                            <h3 class="text-sm font-bold text-gray-500 uppercase mb-2">Pertumbuhan Equity (Realized)</h3>
                            <div class="h-[300px] w-full bg-gray-50 border-2 border-gray-200 rounded p-2">
                                <canvas id="equityChart"></canvas>
                            </div>
                        </div>
                    </div>

                    <div class="overflow-x-auto">
                        <table class="table-brutal">
                            <thead><tr><th>Periode</th><th>Portofolio Return</th><th>IHSG Return (Manual)</th><th>Alpha</th></tr></thead>
                            <tbody id="performance-table-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- 6. TAB SETTINGS -->
            <div id="tab-content-settings" class="tab-content">
                <div class="max-w-2xl mx-auto space-y-6">
                    <div class="card">
                        <h2 class="text-xl font-bold mb-4">Pengaturan Fee</h2>
                        <div class="grid grid-cols-2 gap-4">
                            <div><label>Fee Beli (%)</label><input type="number" id="default-fee-beli" step="0.01"></div>
                            <div><label>Fee Jual (%)</label><input type="number" id="default-fee-jual" step="0.01"></div>
                        </div>
                        <div class="mt-4 text-right"><button id="save-settings-btn" class="btn btn-primary">Simpan</button></div>
                    </div>
                    <div class="card bg-gray-100 border-gray-300">
                         <h2 class="text-xl font-bold mb-4">Data Backup</h2>
                         <div class="flex gap-4">
                            <button id="download-json-btn" class="btn btn-secondary border-black">⬇ Download JSON</button>
                            <label class="btn btn-secondary border-black cursor-pointer">⬆ Upload JSON<input type="file" id="upload-json-input" class="hidden" accept=".json"></label>
                         </div>
                    </div>
                </div>
            </div>

            <!-- 7. TAB DEVELOPER (NEW) -->
            <div id="tab-content-developer" class="tab-content">
                <div class="max-w-3xl mx-auto">
                    <div class="card bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                        <h2 class="text-2xl font-bold mb-6 border-b-2 border-gray-200 pb-4">Tools & Status</h2>
                        
                        <div class="space-y-4 font-mono text-sm mb-8">
                            <div class="flex justify-between p-2 hover:bg-gray-50 rounded">
                                <span class="text-gray-500">User ID:</span>
                                <span id="dev-user-id" class="font-bold text-purple-600 break-all text-right">Not Logged In</span>
                            </div>
                            <div class="flex justify-between p-2 hover:bg-gray-50 rounded">
                                <span class="text-gray-500">Memori Data:</span>
                                <span id="dev-memory-size" class="font-bold">0 KB</span>
                            </div>
                            <div class="flex justify-between p-2 hover:bg-gray-50 rounded">
                                <span class="text-gray-500">Status:</span>
                                <span class="font-bold text-green-600">Idle</span>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button id="btn-generate-dummy" class="btn btn-secondary border-purple-500 text-purple-700 hover:bg-purple-50">
                                🤖 Generate Dummy Data
                            </button>
                            <button id="btn-hard-reset" class="btn btn-danger">
                                ☠️ HARD RESET / CLEAR
                            </button>
                        </div>
                        <p class="mt-4 text-xs text-gray-400 text-center">*Warning: Hard Reset akan menghapus seluruh data secara permanen.</p>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <!-- MODALS -->
    <div id="sim-params-modal" class="modal-overlay">
        <div class="modal-content">
            <h3 class="text-2xl font-bold mb-6 border-b-2 border-black pb-2">Parameter Simulasi</h3>
            <form id="sim-params-form" class="space-y-4">
                <input type="hidden" id="stock-code" value="BBCA"><input type="hidden" id="initial-price" value="9500"><input type="hidden" id="initial-lot" value="10"><input type="hidden" id="dividend" value="227"><input type="hidden" id="avg-down-percent" value="15"><input type="hidden" id="avg-levels" value="5"><input type="hidden" id="avg-strategy" value="lot"><input type="hidden" id="avg-multiplier" value="1"><input type="hidden" id="tp1-percent" value="20"><input type="hidden" id="tp2-percent" value="50"><input type="hidden" id="sim-reason" value="">
                <div class="grid grid-cols-2 gap-4">
                    <div><label>Kode Saham</label><input type="text" id="modal-stock-code" class="font-bold uppercase"></div>
                    <div><label>Harga Awal</label><input type="number" id="modal-initial-price"></div>
                    <div><label>Lot Awal</label><input type="number" id="modal-initial-lot"></div>
                    <div><label>Dividen (Rp)</label><input type="number" id="modal-dividend"></div>
                </div>
                <div class="bg-gray-50 p-3 rounded border-2 border-gray-200">
                    <label class="text-blue-600">Strategi Averaging</label>
                    <div class="grid grid-cols-2 gap-4 mt-2">
                        <div><label class="text-xs text-gray-500">Metode</label><select id="modal-avg-strategy"><option value="lot">Pengali Lot</option><option value="amount">Nominal Sama</option></select></div>
                        <div><label class="text-xs text-gray-500">Pengali (x)</label><input type="number" id="modal-avg-multiplier" step="0.1"></div>
                        <div><label class="text-xs text-gray-500">Jarak (%)</label><input type="number" id="modal-avg-down-percent"></div>
                        <div><label class="text-xs text-gray-500">Max Level</label><input type="number" id="modal-avg-levels"></div>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4"><div><label>TP 1 (%)</label><input type="number" id="modal-tp1-percent"></div><div><label>TP 2 (%)</label><input type="number" id="modal-tp2-percent"></div></div>
                <div><label>Catatan</label><textarea id="modal-sim-reason" rows="2"></textarea></div>
                <div class="flex justify-end gap-2 pt-4 border-t-2 border-gray-100"><button type="button" id="cancel-sim-params-btn" class="btn btn-secondary">Batal</button><button type="button" id="save-simulation-from-modal-btn" class="btn btn-accent">Simpan Preset</button><button type="submit" class="btn btn-primary">Hitung</button></div>
            </form>
        </div>
    </div>
    <div id="add-log-modal" class="modal-overlay">
        <div class="modal-content">
            <h3 class="text-2xl font-bold mb-6">Input Transaksi</h3>
            <form id="log-form" class="space-y-4">
                <input type="hidden" id="log-edit-index">
                <div class="grid grid-cols-2 gap-4"><div><label>Kode</label><input type="text" id="log-stock-code" required class="uppercase font-bold"></div><div><label>Tgl Beli</label><input type="date" id="log-buy-date" required></div><div><label>Harga</label><input type="number" id="log-buy-price" required></div><div><label>Lot</label><input type="number" id="log-buy-lot" required></div><div class="col-span-2"><label>Fee Beli (%)</label><input type="number" id="log-fee-beli" step="0.01"></div></div>
                <div><label>Alasan</label><textarea id="log-reason" rows="2"></textarea></div>
                <div id="sell-fields-container" class="hidden p-4 bg-orange-50 border-2 border-orange-200 rounded mt-2">
                    <h4 class="font-bold text-orange-800 mb-2 text-sm">Penjualan</h4>
                    <div class="grid grid-cols-2 gap-4"><div><label>Harga Jual</label><input type="number" id="log-sell-price"></div><div><label>Tgl Jual</label><input type="date" id="log-sell-date"></div><div class="col-span-2"><label>Fee Jual (%)</label><input type="number" id="log-fee-jual" step="0.01"></div></div>
                </div>
                <div class="flex justify-end gap-2 pt-4"><button type="button" id="cancel-add-log-btn" class="btn btn-secondary">Batal</button><button type="submit" id="submit-log-btn" class="btn btn-primary">Simpan</button></div>
            </form>
        </div>
    </div>
    <div id="sell-modal" class="modal-overlay">
        <div class="modal-content max-w-sm">
            <h3 class="text-xl font-bold mb-4 text-orange-600">Realisasi Profit/Loss</h3>
            <form id="sell-form" class="space-y-4">
                <input type="hidden" id="sell-log-index">
                <div><label>Harga Jual</label><input type="number" id="sell-price" required class="text-lg font-bold text-right"></div>
                <div><label>Tgl Jual</label><input type="date" id="sell-date" required></div>
                <div><label>Fee Jual (%)</label><input type="number" id="sell-fee-jual" step="0.01"></div>
                <div class="flex justify-end gap-2 pt-4"><button type="button" id="cancel-sell-btn" class="btn btn-secondary">Batal</button><button type="submit" class="btn btn-primary bg-orange-500 border-orange-700 text-white hover:bg-orange-600">Eksekusi</button></div>
            </form>
        </div>
    </div>
    <div id="notification-modal" class="modal-overlay">
        <div class="modal-content max-w-sm text-center border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h3 id="notification-title" class="text-xl font-black mb-2 uppercase">Alert</h3>
            <p id="notification-message" class="mb-6 font-medium"></p>
            <button id="notification-ok-btn" class="btn btn-primary w-full">OK</button>
        </div>
    </div>
    
    <!-- NEW GENERIC CONFIRM MODAL -->
    <div id="generic-confirm-modal" class="modal-overlay">
        <div class="modal-content max-w-sm text-center border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div class="text-4xl mb-2">⚠️</div>
            <h3 id="confirm-modal-title" class="text-xl font-black mb-2 uppercase">Konfirmasi</h3>
            <p id="confirm-modal-message" class="mb-6 font-medium">Apakah anda yakin?</p>
            <div class="flex justify-center gap-3">
                <button id="confirm-cancel-btn" class="btn btn-secondary">Batal</button>
                <button id="confirm-ok-btn" class="btn btn-primary">Ya, Lanjutkan</button>
            </div>
        </div>
    </div>

    <!-- Delete Modal is now redundant but kept if needed or replaced by generic -->
    <div id="delete-confirm-modal" class="hidden"></div> 

    <!-- Import Logic Script -->
    <script type="module" src="script.js"></script>
</body>
</html>