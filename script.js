import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDXXt1ZI9WjZhJ0zoKsfInsjWfECK4dWoI",
    authDomain: "richdporto.firebaseapp.com",
    projectId: "richdporto",
    storageBucket: "richdporto.appspot.com",
    messagingSenderId: "720478988067",
    appId: "1:720478988067:web:a21abb0396f99872a38e96",
    measurementId: "G-S793S8TH7V"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

window.firebase = { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, doc, setDoc, getDoc };

// --- DATA VARIABLES ---
let portfolioLog = [];
let savedSimulations = [];
let performanceChart;
let currentMarketPrices = {};
let currentUser = null;
let autoSaveTimer = null;
let defaultFeeBeli = 0.15; 
let defaultFeeJual = 0.25; 

// UPDATED: Meningkatkan items per page agar card tidak tersembunyi di page 2
const itemsPerPage = 50; 
let currentPage = 1;
let filteredLogsData = [];
let sortState = { column: 'date', direction: 'desc' };
const periods = ['1 Bln', '3 Bln', '6 Bln', 'YTD', '1 Thn', 'All Time'];

// --- DOM ELEMENTS ---
const tabButtons = { 
    simulator: document.getElementById('tab-btn-simulator'), 
    log: document.getElementById('tab-btn-log'), 
    saved: document.getElementById('tab-btn-saved'), 
    performance: document.getElementById('tab-btn-performance'),
    settings: document.getElementById('tab-btn-settings')
};
const tabContents = { 
    simulator: document.getElementById('tab-content-simulator'), 
    log: document.getElementById('tab-content-log'), 
    saved: document.getElementById('tab-content-saved'), 
    performance: document.getElementById('tab-content-performance'),
    settings: document.getElementById('tab-content-settings')
};

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfoDiv = document.getElementById('user-info');
const userNameSpan = document.getElementById('user-name');
const syncStatusSpan = document.getElementById('sync-status');
const loginWallOverlay = document.getElementById('login-wall-overlay');
const overlayLoginBtn = document.getElementById('overlay-login-btn');

const modals = {
    simParams: document.getElementById('sim-params-modal'),
    addLog: document.getElementById('add-log-modal'),
    sell: document.getElementById('sell-modal'),
    notification: document.getElementById('notification-modal'),
    deleteConfirm: document.getElementById('delete-confirm-modal')
};

// --- HELPERS ---
function formatCurrency(value, withSign = false) {
    const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(value));
    if (!withSign) return formatted;
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted}`;
    return formatted;
}

function openModal(modal) { modal.classList.add('active'); }
function closeModal(modal) { modal.classList.remove('active'); }

function showNotification(msg, title = 'INFO') {
    document.getElementById('notification-title').textContent = title;
    document.getElementById('notification-message').textContent = msg;
    openModal(modals.notification);
}

let onConfirmAction = null;
function showConfirm(action) {
    onConfirmAction = action;
    openModal(modals.deleteConfirm);
}

function switchTab(name) {
    Object.values(tabButtons).forEach(b => b.classList.remove('active'));
    Object.values(tabContents).forEach(c => c.classList.remove('active'));
    if(tabButtons[name]) tabButtons[name].classList.add('active');
    if(tabContents[name]) tabContents[name].classList.add('active');
    
    // Render tabel performa saat tab dibuka
    if(name === 'performance') {
        renderPerformanceTable();
    }
}

function initChart() {
    const ctx = document.getElementById('performanceChart').getContext('2d');
    if (performanceChart) performanceChart.destroy();
    performanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: periods,
            datasets: [
                { label: 'Portfolio', data: [0,0,0,0,0,0], backgroundColor: '#10b981', borderColor: '#18181b', borderWidth: 2, borderRadius: 4, borderSkipped: false },
                { label: 'IHSG', data: [0,0,0,0,0,0], backgroundColor: '#fb923c', borderColor: '#18181b', borderWidth: 2, borderRadius: 4, borderSkipped: false }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { font: { family: 'Space Grotesk', weight: 'bold' }, color: '#18181b' } } },
            scales: {
                y: { grid: { color: '#e5e7eb', borderDash: [4, 4] }, ticks: { color: '#374151', font: { family: 'Inter' } } },
                x: { grid: { display: false }, ticks: { color: '#374151', font: { family: 'Inter', weight: 'bold' } } }
            }
        }
    });
}

// --- LOGIC: PERFORMANCE TAB ---
function renderPerformanceTable() {
    const tbody = document.getElementById('performance-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    // 1. Hitung Nilai Portofolio Saat Ini (All Time)
    const initialEquity = parseFloat(document.getElementById('initial-equity').value) || 0;
    let totalMarketValue = 0;
    let cashFlow = 0;

    // Hitung Cash Flow dan Nilai Pasar
    portfolioLog.forEach(log => {
        const buyVal = log.price * log.lot * 100 * (1 + (log.feeBeli||0)/100);
        cashFlow -= buyVal; // Uang keluar untuk beli

        // UPDATED: Cek isSold lebih robust
        const isSold = log.sellPrice !== null && log.sellPrice !== undefined && log.sellPrice !== '';

        if(isSold) {
            const sellVal = log.sellPrice * log.lot * 100 * (1 - (log.feeJual||0)/100);
            cashFlow += sellVal; // Uang masuk dari jual
        } else {
            // Untuk posisi terbuka, hitung nilai pasarnya
            const currPrice = parseFloat(currentMarketPrices[log.code]) || log.price;
            totalMarketValue += currPrice * log.lot * 100;
        }
    });

    const currentCash = initialEquity + cashFlow;
    const totalPortfolioValue = currentCash + totalMarketValue;
    const allTimeReturn = initialEquity > 0 ? ((totalPortfolioValue - initialEquity) / initialEquity) * 100 : 0;

    // 2. Render Baris Tabel
    periods.forEach((period, index) => {
        const isAllTime = period === 'All Time';
        const portReturn = isAllTime ? allTimeReturn : 0; // Placeholder 0 untuk periode lain (karena butuh data historis)
        const displayReturn = isAllTime ? portReturn.toFixed(2) + '%' : '-';
        const colorClass = isAllTime ? (portReturn >= 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-400';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="font-bold">${period}</td>
            <td class="${colorClass} font-bold">${displayReturn}</td>
            <td>
                <input type="number" step="0.01" class="ihsg-input w-24 p-1 border rounded text-right bg-gray-50" data-index="${index}" placeholder="0.00"> %
            </td>
            <td class="font-bold" id="alpha-${index}">-</td>
        `;
        tbody.appendChild(tr);
    });

    // 3. Update Chart (All Time Bar)
    if(performanceChart) {
        performanceChart.data.datasets[0].data[5] = allTimeReturn;
        performanceChart.update();
    }

    // 4. Event Listener untuk Input IHSG
    document.querySelectorAll('.ihsg-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = e.target.dataset.index;
            const ihsgVal = parseFloat(e.target.value) || 0;
            const isAllTimeRow = periods[idx] === 'All Time';
            
            // Update Alpha Cell
            const portVal = isAllTimeRow ? allTimeReturn : 0; 
            
            if(isAllTimeRow) {
                const alpha = portVal - ihsgVal;
                const alphaCell = document.getElementById(`alpha-${idx}`);
                alphaCell.textContent = alpha.toFixed(2) + '%';
                alphaCell.className = `font-bold ${alpha >= 0 ? 'text-green-600' : 'text-red-600'}`;
                
                // Update Chart IHSG Bar
                if(performanceChart) {
                    performanceChart.data.datasets[1].data[5] = ihsgVal;
                    performanceChart.update();
                }
            }
        });
    });
}

// --- LOGIC: SIMULATOR ---
function calculateDashboard() {
    const initialPrice = parseFloat(document.getElementById('initial-price').value) || 0;
    const initialLot = parseFloat(document.getElementById('initial-lot').value) || 0;
    const dividend = parseFloat(document.getElementById('dividend').value) || 0;
    const avgDownPercent = parseFloat(document.getElementById('avg-down-percent').value) || 0;
    const avgLevels = parseInt(document.getElementById('avg-levels').value) || 0;
    const tp1Percent = parseFloat(document.getElementById('tp1-percent').value) || 0;
    const tp2Percent = parseFloat(document.getElementById('tp2-percent').value) || 0;
    const avgStrategy = document.getElementById('avg-strategy').value;
    const avgMultiplier = parseFloat(document.getElementById('avg-multiplier').value) || 1;

    const strategyText = avgStrategy === 'lot' ? 'Lot Multiplier' : 'Fixed Amount';
    document.getElementById('active-sim-params-display').innerHTML = `
        <div class="bg-white p-2 border border-gray-300 rounded"><div class="text-gray-500 text-xs">CODE</div><div class="font-bold text-lg text-blue-600">${document.getElementById('stock-code').value}</div></div>
        <div class="bg-white p-2 border border-gray-300 rounded"><div class="text-gray-500 text-xs">ENTRY</div><div class="font-bold">${formatCurrency(initialPrice)}</div></div>
        <div class="bg-white p-2 border border-gray-300 rounded"><div class="text-gray-500 text-xs">LOT AWAL</div><div class="font-bold">${initialLot}</div></div>
        <div class="bg-white p-2 border border-gray-300 rounded"><div class="text-gray-500 text-xs">GAP</div><div class="font-bold">-${avgDownPercent}%</div></div>
        <div class="bg-white p-2 border border-gray-300 rounded"><div class="text-gray-500 text-xs">STRATEGY</div><div class="font-bold">${strategyText} x${avgMultiplier}</div></div>
    `;

    const tableBody = document.getElementById('scenario-table-body');
    tableBody.innerHTML = ''; 

    let cumulativeCost = 0, cumulativeShares = 0, currentPrice = initialPrice;
    const initialBuyAmount = initialPrice * initialLot * 100;

    for (let i = 0; i <= avgLevels; i++) {
        let entryPrice, lotsToBuy;
        if (i === 0) {
            entryPrice = initialPrice; lotsToBuy = initialLot;
        } else {
            entryPrice = currentPrice * (1 - avgDownPercent / 100);
            if (avgStrategy === 'lot') {
                lotsToBuy = initialLot * Math.pow(avgMultiplier, i);
            } else {
                const targetAmount = initialBuyAmount * avgMultiplier;
                lotsToBuy = Math.round((targetAmount / entryPrice) / 100);
            }
        }
        if (lotsToBuy <= 0) lotsToBuy = 1;
        const sharesToBuy = lotsToBuy * 100;
        const totalBuy = entryPrice * sharesToBuy;
        cumulativeCost += totalBuy; cumulativeShares += sharesToBuy;
        const avgPrice = cumulativeCost / cumulativeShares;
        const dividendYield = dividend > 0 ? (dividend / entryPrice) * 100 : 0;
        const tp1Price = avgPrice * (1 + tp1Percent / 100);
        const tp2Price = avgPrice * (1 + tp2Percent / 100);
        const profitTp1 = (tp1Price - avgPrice) * cumulativeShares;
        const profitTp2 = (tp2Price - avgPrice) * cumulativeShares;

        const row = `<tr><td class="font-bold text-gray-400">LVL ${i}</td><td class="font-mono">${formatCurrency(entryPrice)}</td><td class="font-mono">${lotsToBuy}</td><td class="font-mono text-gray-600">${formatCurrency(totalBuy)}</td><td class="${dividendYield > 5 ? 'text-green-600 font-bold' : 'text-gray-400'}">${dividendYield.toFixed(1)}%</td><td class="font-bold text-blue-600 bg-blue-50">${formatCurrency(avgPrice)}</td><td><div class="text-xs text-gray-500">${formatCurrency(tp1Price)}</div><div class="font-bold text-green-600">+${formatCurrency(profitTp1)}</div></td><td><div class="text-xs text-gray-500">${formatCurrency(tp2Price)}</div><div class="font-bold text-green-600">+${formatCurrency(profitTp2)}</div></td></tr>`;
        tableBody.innerHTML += row;
        currentPrice = entryPrice;
    }
    const totalLots = cumulativeShares / 100;
    const finalAvg = cumulativeCost / cumulativeShares;
    document.getElementById('summary-total-investment').textContent = formatCurrency(cumulativeCost);
    document.getElementById('summary-total-lot').textContent = totalLots;
    document.getElementById('summary-avg-price').textContent = formatCurrency(finalAvg);
    
    const reason = document.getElementById('sim-reason').value;
    const reasonCard = document.getElementById('simulation-reason-card');
    if(reason) {
        document.getElementById('simulation-reason-display').textContent = reason;
        reasonCard.classList.remove('hidden');
    } else {
        reasonCard.classList.add('hidden');
    }
}

function renderLogTable(logs = portfolioLog) {
    const tbody = document.getElementById('log-table-body');
    const cardView = document.getElementById('log-card-view');
    if(!tbody || !cardView) return;
    tbody.innerHTML = ''; 
    cardView.innerHTML = '';

    const start = (currentPage - 1) * itemsPerPage;
    const pagedLogs = logs.slice(start, start + itemsPerPage);
    
    // Update Info Halaman
    const totalItems = logs.length;
    const end = Math.min(start + itemsPerPage, totalItems);
    document.getElementById('page-info').textContent = totalItems > 0 
        ? `Showing ${start + 1}-${end} of ${totalItems}` 
        : 'No transactions found';
    
    const totalPages = Math.ceil(logs.length / itemsPerPage);
    const pageCont = document.getElementById('page-number-container');
    pageCont.innerHTML = '';

    // --- PAGINATION LOGIC ---
    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '← Prev';
    prevBtn.className = 'pagination-btn';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => { if(currentPage > 1) { currentPage--; renderLogTable(filteredLogsData); } };
    pageCont.appendChild(prevBtn);

    for(let i=1; i<=totalPages; i++){
        if (totalPages > 7 && (i !== 1 && i !== totalPages && Math.abs(currentPage - i) > 2)) {
             if (i === 2 || i === totalPages - 1) {
                 const ellipsis = document.createElement('span');
                 ellipsis.textContent = '...';
                 ellipsis.className = 'pagination-info mx-1';
                 pageCont.appendChild(ellipsis);
             }
             continue; 
        }
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
        btn.onclick = () => { currentPage = i; renderLogTable(filteredLogsData); };
        pageCont.appendChild(btn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = 'Next →';
    nextBtn.className = 'pagination-btn';
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    nextBtn.onclick = () => { if(currentPage < totalPages) { currentPage++; renderLogTable(filteredLogsData); } };
    pageCont.appendChild(nextBtn);

    // Handle Empty State
    if(pagedLogs.length === 0) {
        cardView.innerHTML = '<div class="text-center text-gray-500 py-8 italic">Belum ada data transaksi yang sesuai filter.</div>';
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500 italic">Belum ada data transaksi yang sesuai filter.</td></tr>';
        return;
    }

    pagedLogs.forEach((log, index) => {
        // Cari index asli di array utama untuk referensi tombol
        const realIndex = portfolioLog.indexOf(log);

        // UPDATED: Logic penentu status Open/Closed yang lebih robust
        // Jika sellPrice null, undefined, atau empty string -> OPEN
        const isOpen = log.sellPrice === null || log.sellPrice === undefined || log.sellPrice === '';
        
        const buyCost = log.price * log.lot * 100 * (1 + (log.feeBeli||0)/100);
        let pl = 0;
        if(!isOpen) {
            const sellVal = log.sellPrice * log.lot * 100 * (1 - (log.feeJual||0)/100);
            pl = sellVal - buyCost;
        }
        
        // --- RENDER DESKTOP TABLE ROW ---
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="font-mono text-xs">${log.date}</td>
            <td class="font-bold text-blue-700">${log.code}</td>
            <td class="text-right font-mono">${formatCurrency(log.price)}</td>
            <td class="text-right font-mono">${log.lot}</td>
            <td class="text-center"><span class="badge ${isOpen ? 'badge-open' : 'badge-closed'}">${isOpen ? 'OPEN' : 'CLOSED'}</span></td>
            <td class="text-right font-bold ${isOpen ? 'text-gray-400' : (pl >= 0 ? 'text-green-600' : 'text-red-500')}">${isOpen ? '-' : formatCurrency(pl, true)}</td>
            <td class="text-center"><div class="flex justify-center gap-1">${isOpen ? `<button class="btn-sell btn btn-accent px-2 py-0 text-xs border-black" data-index="${realIndex}">JUAL</button>` : ''}<button class="btn-edit btn btn-secondary px-2 py-0 text-xs border-black" data-index="${realIndex}">EDIT</button><button class="btn-delete text-red-500 hover:text-red-700 px-2" data-index="${realIndex}">✕</button></div></td>
        `;
        tbody.appendChild(tr);

        // --- RENDER MOBILE CARD ---
        const card = document.createElement('div');
        card.className = 'card p-4 relative bg-white border-2 border-gray-200 rounded-lg shadow-sm mb-4'; // Pastikan background white dan border ada
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div>
                    <span class="text-xs font-mono text-gray-500">${log.date}</span>
                    <h4 class="text-xl font-black text-blue-700 tracking-tight">${log.code}</h4>
                </div>
                <span class="badge ${isOpen ? 'badge-open' : 'badge-closed'}">${isOpen ? 'OPEN' : 'CLOSED'}</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-sm mb-3">
                <div>
                    <span class="text-xs text-gray-400 uppercase font-bold">Buy Price</span>
                    <div class="font-mono font-bold">${formatCurrency(log.price)}</div>
                </div>
                <div>
                    <span class="text-xs text-gray-400 uppercase font-bold">Lot</span>
                    <div class="font-mono font-bold">${log.lot}</div>
                </div>
                ${!isOpen ? `
                <div class="col-span-2 pt-2 mt-1 border-t-2 border-gray-100 flex justify-between items-center">
                    <span class="text-xs text-gray-500 font-bold uppercase">Realized P/L</span>
                    <span class="font-bold text-lg ${pl>=0?'text-green-600':'text-red-500'}">${formatCurrency(pl, true)}</span>
                </div>` : ''}
            </div>
            <div class="flex gap-2 mt-2 border-t-2 border-gray-100 pt-3">
                ${isOpen ? `<button class="btn-sell flex-1 btn btn-accent text-xs py-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border-black" data-index="${realIndex}">JUAL</button>` : ''}
                <button class="btn-edit flex-1 btn btn-secondary text-xs py-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border-black" data-index="${realIndex}">EDIT</button>
                <button class="btn-delete btn btn-danger text-xs py-2 px-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border-black" data-index="${realIndex}">✕</button>
            </div>
        `;
        cardView.appendChild(card);
    });
    
    document.querySelectorAll('.btn-sell').forEach(b => b.onclick = () => openSellModal(b.dataset.index));
    document.querySelectorAll('.btn-edit').forEach(b => b.onclick = () => editLog(b.dataset.index));
    document.querySelectorAll('.btn-delete').forEach(b => b.onclick = () => deleteLog(b.dataset.index));
    calculatePortfolioSummary();
}

function calculatePortfolioSummary() {
    const initialEquity = parseFloat(document.getElementById('initial-equity').value) || 0;
    let totalBuy = 0, totalSell = 0, realizedPL = 0;
    let stockHoldings = {};
    
    portfolioLog.forEach(log => {
        const buyVal = log.price * log.lot * 100 * (1 + (log.feeBeli||0)/100);
        totalBuy += buyVal;
        
        // UPDATED: Cek konsisten untuk summary
        const isSold = log.sellPrice !== null && log.sellPrice !== undefined && log.sellPrice !== '';

        if(isSold) {
            const sellVal = log.sellPrice * log.lot * 100 * (1 - (log.feeJual||0)/100);
            totalSell += sellVal; realizedPL += (sellVal - buyVal);
        } else {
            if(!stockHoldings[log.code]) stockHoldings[log.code] = { lot: 0, cost: 0 };
            stockHoldings[log.code].lot += log.lot; stockHoldings[log.code].cost += buyVal;
        }
    });

    const currentEquity = initialEquity - totalBuy + totalSell;
    document.getElementById('current-equity-display').textContent = formatCurrency(currentEquity);
    document.getElementById('realized-pl-summary').innerHTML = `<div class="flex justify-between text-sm mt-2 font-bold ${realizedPL>=0?'text-green-600':'text-red-500'}"><span>Realized P/L</span> <span>${formatCurrency(realizedPL, true)}</span></div>`;
    const summaryContainer = document.getElementById('portfolio-summary-by-stock');
    summaryContainer.innerHTML = '';
    
    let totalFloating = 0;
    Object.keys(stockHoldings).forEach(code => {
        const data = stockHoldings[code];
        const avgPrice = data.cost / (data.lot * 100);
        const currPrice = parseFloat(currentMarketPrices[code]) || 0;
        let floating = 0;
        if(currPrice > 0) { floating = (currPrice * data.lot * 100) - data.cost; totalFloating += floating; }
        
        const div = document.createElement('div');
        div.className = 'card bg-white p-3 border-2 border-gray-200';
        div.innerHTML = `<div class="flex justify-between items-center mb-2"><span class="font-black text-lg">${code}</span><span class="text-xs bg-gray-100 px-2 rounded">Lot: ${data.lot}</span></div><div class="text-xs text-gray-500 mb-1">Avg: ${formatCurrency(avgPrice)}</div><div class="flex items-center gap-2 mb-2"><span class="text-xs">Market:</span><input type="number" value="${currPrice || ''}" class="price-input w-24 text-right p-1 h-6 text-sm border-gray-300" placeholder="Harga" data-code="${code}"></div><div class="text-right font-bold ${floating>=0?'text-green-500':'text-red-500'}">${currPrice > 0 ? formatCurrency(floating, true) : 'Set Price'}</div>`;
        summaryContainer.appendChild(div);
    });
    
    document.querySelectorAll('.price-input').forEach(input => { input.onchange = (e) => updatePrice(e.target.dataset.code, e.target.value); });
    document.getElementById('floating-pl-summary').innerHTML = `<div class="flex justify-between text-sm font-bold ${totalFloating>=0?'text-green-600':'text-red-500'}"><span>Floating P/L</span> <span>${formatCurrency(totalFloating, true)}</span></div>`;
    
    renderPerformanceTable();
}

function updatePrice(code, price) { currentMarketPrices[code] = price; calculatePortfolioSummary(); triggerAutoSave(); }
function deleteLog(index) { showConfirm(() => { portfolioLog.splice(index, 1); refreshData(); closeModal(modals.deleteConfirm); }); }
function openSellModal(index) { document.getElementById('sell-log-index').value = index; document.getElementById('sell-date').value = new Date().toISOString().split('T')[0]; document.getElementById('sell-fee-jual').value = defaultFeeJual; openModal(modals.sell); }
function editLog(index) {
    const log = portfolioLog[index];
    document.getElementById('log-edit-index').value = index;
    document.getElementById('log-stock-code').value = log.code;
    document.getElementById('log-buy-date').value = log.date;
    document.getElementById('log-buy-price').value = log.price;
    document.getElementById('log-buy-lot').value = log.lot;
    document.getElementById('log-fee-beli').value = log.feeBeli || defaultFeeBeli;
    document.getElementById('log-reason').value = log.reason || '';
    const sellContainer = document.getElementById('sell-fields-container');
    
    // UPDATED: Gunakan logic konsisten untuk menampilkan form jual
    if(log.sellPrice !== null && log.sellPrice !== undefined && log.sellPrice !== '') {
        sellContainer.classList.remove('hidden');
        document.getElementById('log-sell-price').value = log.sellPrice;
        document.getElementById('log-sell-date').value = log.sellDate;
        document.getElementById('log-fee-jual').value = log.feeJual;
    } else { sellContainer.classList.add('hidden'); }
    openModal(modals.addLog);
}

document.getElementById('sim-params-form').addEventListener('submit', (e) => { e.preventDefault(); ['stock-code', 'initial-price', 'initial-lot', 'dividend', 'avg-down-percent', 'avg-levels', 'avg-strategy', 'avg-multiplier', 'tp1-percent', 'tp2-percent', 'sim-reason'].forEach(id => { document.getElementById(id).value = document.getElementById(`modal-${id}`).value; }); calculateDashboard(); closeModal(modals.simParams); triggerAutoSave(); });
document.getElementById('log-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const idxVal = document.getElementById('log-edit-index').value;
    const isEdit = idxVal !== '';
    const newLog = { id: isEdit ? portfolioLog[idxVal].id : Date.now(), code: document.getElementById('log-stock-code').value.toUpperCase(), date: document.getElementById('log-buy-date').value, price: parseFloat(document.getElementById('log-buy-price').value), lot: parseInt(document.getElementById('log-buy-lot').value), feeBeli: parseFloat(document.getElementById('log-fee-beli').value), reason: document.getElementById('log-reason').value, sellPrice: null, sellDate: null, feeJual: null };
    const sellP = document.getElementById('log-sell-price').value;
    if(sellP && !document.getElementById('sell-fields-container').classList.contains('hidden')) {
        newLog.sellPrice = parseFloat(sellP);
        newLog.sellDate = document.getElementById('log-sell-date').value;
        newLog.feeJual = parseFloat(document.getElementById('log-fee-jual').value);
    }
    if(isEdit) portfolioLog[idxVal] = newLog; else portfolioLog.push(newLog);
    closeModal(modals.addLog); refreshData();
});
document.getElementById('sell-form').addEventListener('submit', (e) => { e.preventDefault(); const idx = document.getElementById('sell-log-index').value; const log = portfolioLog[idx]; log.sellPrice = parseFloat(document.getElementById('sell-price').value); log.sellDate = document.getElementById('sell-date').value; log.feeJual = parseFloat(document.getElementById('sell-fee-jual').value); closeModal(modals.sell); refreshData(); });
document.getElementById('save-simulation-from-modal-btn').addEventListener('click', () => { const sim = { id: Date.now(), stockCode: document.getElementById('modal-stock-code').value, initialPrice: document.getElementById('modal-initial-price').value, initialLot: document.getElementById('modal-initial-lot').value, avgStrategy: document.getElementById('modal-avg-strategy').value, avgMultiplier: document.getElementById('modal-avg-multiplier').value, avgDownPercent: document.getElementById('modal-avg-down-percent').value, avgLevels: document.getElementById('modal-avg-levels').value }; savedSimulations.push(sim); renderSavedSimulations(); triggerAutoSave(); showNotification('Simulasi tersimpan!'); });

function renderSavedSimulations() {
    const tbody = document.getElementById('saved-simulations-table-body'); if(!tbody) return; tbody.innerHTML = '';
    savedSimulations.forEach((sim, idx) => { const tr = document.createElement('tr'); tr.innerHTML = `<td class="font-bold">${sim.stockCode}</td><td>${formatCurrency(sim.initialPrice)}</td><td>${sim.initialLot}</td><td>${sim.avgStrategy} x${sim.avgMultiplier}</td><td>${sim.avgDownPercent}%</td><td>${sim.avgLevels}</td><td><button class="btn-load btn btn-secondary py-0 px-2 text-xs border-black" data-index="${idx}">LOAD</button><button class="btn-del-sim text-red-500 ml-2" data-index="${idx}">✕</button></td>`; tbody.appendChild(tr); });
    document.querySelectorAll('.btn-load').forEach(b => b.onclick = () => loadSim(b.dataset.index));
    document.querySelectorAll('.btn-del-sim').forEach(b => b.onclick = () => deleteSim(b.dataset.index));
}

function loadSim(idx) { const sim = savedSimulations[idx]; document.getElementById('stock-code').value = sim.stockCode; document.getElementById('initial-price').value = sim.initialPrice; document.getElementById('initial-lot').value = sim.initialLot; document.getElementById('avg-strategy').value = sim.avgStrategy; document.getElementById('avg-multiplier').value = sim.avgMultiplier; document.getElementById('avg-down-percent').value = sim.avgDownPercent; document.getElementById('avg-levels').value = sim.avgLevels; document.getElementById('modal-stock-code').value = sim.stockCode; document.getElementById('modal-initial-price').value = sim.initialPrice; document.getElementById('modal-initial-lot').value = sim.initialLot; document.getElementById('modal-avg-strategy').value = sim.avgStrategy; document.getElementById('modal-avg-multiplier').value = sim.avgMultiplier; document.getElementById('modal-avg-down-percent').value = sim.avgDownPercent; document.getElementById('modal-avg-levels').value = sim.avgLevels; calculateDashboard(); switchTab('simulator'); }
function deleteSim(idx) { showConfirm(() => { savedSimulations.splice(idx, 1); renderSavedSimulations(); triggerAutoSave(); closeModal(modals.deleteConfirm); }); }
document.getElementById('filter-apply-btn').addEventListener('click', () => { const code = document.getElementById('filter-stock-code').value.toUpperCase(); const status = document.getElementById('filter-status').value; filteredLogsData = portfolioLog.filter(log => { if(code && !log.code.includes(code)) return false; if(status === 'open' && log.sellPrice) return false; if(status === 'closed' && !log.sellPrice) return false; return true; }); currentPage = 1; renderLogTable(filteredLogsData); });
document.getElementById('filter-reset-btn').addEventListener('click', () => { document.getElementById('filter-stock-code').value = ''; filteredLogsData = portfolioLog; renderLogTable(filteredLogsData); });
document.getElementById('download-json-btn').addEventListener('click', () => { const data = { portfolioLog, savedSimulations, currentMarketPrices, defaultFeeBeli, defaultFeeJual }; const blob = new Blob([JSON.stringify(data)], {type: 'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'portfolio_backup.json'; a.click(); });
document.getElementById('upload-json-input').addEventListener('change', (e) => { const file = e.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (ev) => { const data = JSON.parse(ev.target.result); portfolioLog = data.portfolioLog || []; savedSimulations = data.savedSimulations || []; currentMarketPrices = data.currentMarketPrices || {}; refreshData(); showNotification('Data Restore Berhasil!'); }; reader.readAsText(file); });

function triggerAutoSave() { if(!currentUser) return; syncStatusSpan.style.opacity = 1; clearTimeout(autoSaveTimer); autoSaveTimer = setTimeout(async () => { const data = { portfolioLog, savedSimulations, currentMarketPrices, updatedAt: new Date().toISOString() }; try { await setDoc(doc(db, "portfolios", currentUser.uid), data); syncStatusSpan.textContent = 'SAVED'; setTimeout(() => syncStatusSpan.style.opacity = 0, 2000); } catch(e) { syncStatusSpan.textContent = 'ERROR'; } }, 1000); }
async function loadCloudData() { if(!currentUser) return; const docSnap = await getDoc(doc(db, "portfolios", currentUser.uid)); if(docSnap.exists()) { const data = docSnap.data(); portfolioLog = data.portfolioLog || []; savedSimulations = data.savedSimulations || []; currentMarketPrices = data.currentMarketPrices || {}; refreshData(); } }
function refreshData() { filteredLogsData = portfolioLog; renderLogTable(); renderSavedSimulations(); calculateDashboard(); renderPerformanceTable(); }

// --- MOBILE ACCORDION LOGIC ---
function initMobileAccordion() {
    const toggleSummary = document.getElementById('toggle-summary-btn');
    const contentSummary = document.getElementById('summary-content');
    const arrowSummary = document.getElementById('arrow-summary');

    const toggleFilter = document.getElementById('toggle-filter-btn');
    const contentFilter = document.getElementById('filter-content');
    const arrowFilter = document.getElementById('arrow-filter');

    // Helper to check if mobile
    const isMobile = () => window.innerWidth < 1024;

    if(toggleSummary) {
        toggleSummary.addEventListener('click', () => {
            if(isMobile()) {
                contentSummary.classList.toggle('hidden');
                arrowSummary.classList.toggle('rotate-180');
            }
        });
        // Initialize open on mobile? Let's keep summary open, filter closed by default maybe?
        // For now, let's keep them consistent with HTML (default visible)
    }

    if(toggleFilter) {
        toggleFilter.addEventListener('click', () => {
            if(isMobile()) {
                contentFilter.classList.toggle('hidden');
                arrowFilter.classList.toggle('rotate-180');
            }
        });
    }
}

window.addEventListener('load', () => {
    initChart(); calculateDashboard(); 
    document.querySelectorAll('.tab-button').forEach(btn => { btn.addEventListener('click', (e) => switchTab(e.target.id.replace('tab-btn-', ''))); });
    document.getElementById('open-add-log-modal-btn').addEventListener('click', () => { document.getElementById('log-form').reset(); document.getElementById('log-edit-index').value = ''; document.getElementById('sell-fields-container').classList.add('hidden'); document.getElementById('log-buy-date').value = new Date().toISOString().split('T')[0]; document.getElementById('log-fee-beli').value = defaultFeeBeli; openModal(modals.addLog); });
    document.getElementById('cancel-add-log-btn').addEventListener('click', () => closeModal(modals.addLog));
    document.getElementById('open-sim-params-modal-btn').addEventListener('click', () => { ['stock-code', 'initial-price', 'initial-lot', 'dividend', 'avg-down-percent', 'avg-levels', 'tp1-percent', 'tp2-percent', 'sim-reason'].forEach(id => document.getElementById(`modal-${id}`).value = document.getElementById(id).value); openModal(modals.simParams); });
    document.getElementById('cancel-sim-params-btn').addEventListener('click', () => closeModal(modals.simParams));
    document.getElementById('cancel-sell-btn').addEventListener('click', () => closeModal(modals.sell));
    document.getElementById('notification-ok-btn').addEventListener('click', () => closeModal(modals.notification));
    document.getElementById('cancel-delete-btn').addEventListener('click', () => closeModal(modals.deleteConfirm));
    document.getElementById('confirm-delete-btn').addEventListener('click', () => { if(onConfirmAction) onConfirmAction(); });
    
    // --- AUTH HANDLER ---
    const handleLogin = async () => { try { await signInWithPopup(auth, provider); } catch(e) { showNotification(e.message); } };
    loginBtn.addEventListener('click', handleLogin); 
    overlayLoginBtn.addEventListener('click', handleLogin); 

    logoutBtn.addEventListener('click', () => signOut(auth));
    
    onAuthStateChanged(auth, (user) => { 
        currentUser = user; 
        if(user) { 
            loginWallOverlay.classList.add('hidden-wall');
            loginBtn.classList.add('hidden'); 
            userInfoDiv.classList.remove('hidden'); 
            userInfoDiv.classList.add('flex'); 
            userNameSpan.textContent = user.displayName; 
            loadCloudData(); 
        } else { 
            loginWallOverlay.classList.remove('hidden-wall');
            loginBtn.classList.add('hidden');
            userInfoDiv.classList.add('hidden'); 
            userInfoDiv.classList.remove('flex'); 
            portfolioLog = []; 
            savedSimulations = []; 
            refreshData(); 
        } 
    });

    const nav = document.getElementById('tab-nav-wrapper'); const navOffset = nav.offsetTop; window.addEventListener('scroll', () => { if(window.scrollY >= navOffset) nav.classList.add('sticky-state'); else nav.classList.remove('sticky-state'); });

    // Init Accordion
    initMobileAccordion();
});