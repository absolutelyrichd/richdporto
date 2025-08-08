// Import the functions you need from the SDKs you need
// CATATAN: Metode import ini berfungsi saat dijalankan langsung di browser,
// namun akan menyebabkan error saat proses 'build' di Vercel.
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDXXt1ZI9WjZhJ0zoKsfInsjWfECK4dWoI",
    authDomain: "richdporto.firebaseapp.com",
    projectId: "richdporto",
    storageBucket: "richdporto.appspot.com",
    messagingSenderId: "720478988067",
    appId: "1:720478988067:web:a21abb0396f99872a38e96",
    measurementId: "G-S793S8TH7V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Make functions available globally
window.firebase = {
    auth,
    db,
    provider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    doc,
    setDoc,
    getDoc
};

// --- API KEY UNTUK HARGA REAL-TIME ---
const POLYGON_API_KEY = "F6Kl67QGMHtli_xcPVU5ZQaQK4MaEf6Z"; 

// --- DATA STORAGE ---
let portfolioLog = [];
let savedSimulations = [];
let performanceChart;
let currentMarketPrices = {};
let currentUser = null;
let autoSaveTimer = null;
let deleteLogIndexToConfirm = -1; // New variable to store the index for deletion confirmation
let defaultFeeBeli = 0.11; // Default value for buy fee
let defaultFeeJual = 0.11; // Default value for sell fee
let isFetchingPrice = false; // Flag untuk mencegah panggilan API ganda

// --- Sort state for portfolio log ---
let sortState = {
    column: 'date',
    direction: 'desc'
};


// --- DOM Elements ---
const tabButtons = { 
    simulator: document.getElementById('tab-btn-simulator'), 
    log: document.getElementById('tab-btn-log'), 
    saved: document.getElementById('tab-btn-saved'), 
    performance: document.getElementById('tab-btn-performance'),
    backup: document.getElementById('tab-btn-backup'),
    settings: document.getElementById('tab-btn-settings') // New settings tab button
};
const tabContents = { 
    simulator: document.getElementById('tab-content-simulator'), 
    log: document.getElementById('tab-content-log'), 
    saved: document.getElementById('tab-content-saved'), 
    performance: document.getElementById('tab-content-performance'),
    backup: document.getElementById('tab-content-backup'),
    settings: document.getElementById('tab-content-settings') // New settings tab content
};

// Modal Elements
const simParamsModal = document.getElementById('sim-params-modal');
const addLogModal = document.getElementById('add-log-modal');
const sellModal = document.getElementById('sell-modal');
const notificationModal = document.getElementById('notification-modal');
const deleteConfirmModal = document.getElementById('delete-confirm-modal'); // New delete confirmation modal

// Form Elements
const simParamsForm = document.getElementById('sim-params-form');
const logForm = document.getElementById('log-form');
const sellForm = document.getElementById('sell-form');

// Auth & Sync Elements
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfoDiv = document.getElementById('user-info');
const userNameSpan = document.getElementById('user-name');
const syncStatusSpan = document.getElementById('sync-status');

// Backup Elements
const downloadJsonBtn = document.getElementById('download-json-btn');
const uploadJsonInput = document.getElementById('upload-json-input');

// Log Modal specific elements for Edit feature
const logModalTitle = document.getElementById('log-modal-title');
const logEditIndexInput = document.getElementById('log-edit-index');
const submitLogBtn = document.getElementById('submit-log-btn');
const logFeeBeliInput = document.getElementById('log-fee-beli');
const logSellPriceInput = document.getElementById('log-sell-price');
const logSellDateInput = document.getElementById('log-sell-date');
const logFeeJualInput = document.getElementById('log-fee-jual');
const sellFieldsContainer = document.getElementById('sell-fields-container');

// Settings Elements
const defaultFeeBeliInput = document.getElementById('default-fee-beli');
const defaultFeeJualInput = document.getElementById('default-fee-jual');
const saveSettingsBtn = document.getElementById('save-settings-btn');

// Filter Elements
const filterDateFromInput = document.getElementById('filter-date-from');
const filterDateToInput = document.getElementById('filter-date-to');
const filterStockCodeInput = document.getElementById('filter-stock-code');
const filterReasonInput = document.getElementById('filter-reason');
const filterStatusSelect = document.getElementById('filter-status');
const filterApplyBtn = document.getElementById('filter-apply-btn');
const filterResetBtn = document.getElementById('filter-reset-btn');


// Custom Confirmation Modal Elements
const customConfirmTitle = document.getElementById('delete-confirm-modal').querySelector('h3');
const customConfirmMessage = document.getElementById('delete-confirm-modal').querySelector('p');
const customConfirmBtn = document.getElementById('confirm-delete-btn');
const customCancelBtn = document.getElementById('cancel-delete-btn');


// --- HELPER FUNCTIONS ---
function formatCurrency(value, withSign = false) {
    const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(value));
    if (!withSign) return formatted;
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted}`;
    return formatted;
}

// --- TAB MANAGEMENT ---
function switchTab(tabName) {
    console.log('Switching to tab:', tabName);
    // Remove 'active' from all tab buttons
    Object.values(tabButtons).forEach(btn => {
        if (btn) { // Ensure the button element exists
            btn.classList.remove('active');
        }
    });

    // Remove 'active' from all tab content divs
    Object.values(tabContents).forEach(content => {
        if (content) { // Ensure the content element exists
            content.classList.remove('active');
        }
    });
    
    // Get the target button and content
    const targetButton = tabButtons[tabName];
    const targetContent = tabContents[tabName];

    // Add 'active' to the selected tab button and content
    if (targetButton && targetContent) {
        targetButton.classList.add('active');
        targetContent.classList.add('active');
        console.log(`Successfully activated tab: ${tabName}`);
    } else {
        console.error(`Error: Tab button or content not found for tabName: ${tabName}. Check if the ID is correct in index.html and script.js.`);
    }
}

// --- AUTHENTICATION ---
async function handleGoogleLogin() {
    try {
        await window.firebase.signInWithPopup(window.firebase.auth, window.firebase.provider);
    } catch (error) {
        console.error("Error during login:", error);
        showNotification(`Login gagal: ${error.message}`, 'Error');
    }
}

async function handleLogout() {
    console.log('Logout button clicked.');
    // Use custom confirmation modal instead of browser's confirm()
    showCustomConfirmModal(
        'Konfirmasi Logout',
        'Apakah Anda yakin ingin logout? Data yang belum tersimpan mungkin hilang.',
        'Logout',
        'Batal',
        async () => { // onConfirm callback
            console.log('Logout confirmed.');
            try {
                await window.firebase.signOut(window.firebase.auth);
                showNotification('Logout berhasil.', 'Sukses');
                resetAllData();
                closeModal(deleteConfirmModal); // Close the modal after successful logout
                console.log('Logout successful, modal closed.');
            } catch (error) {
                console.error("Error during logout:", error);
                showNotification(`Logout gagal: ${error.message}`, 'Error');
                closeModal(deleteConfirmModal); // Ensure modal closes even on error
                console.log('Logout error, modal closed.');
            }
        },
        () => { // onCancel callback
            console.log('Logout cancelled.');
            closeModal(deleteConfirmModal); // Close the modal if cancelled
        }
    );
}

function updateUIForAuthState(user) {
    currentUser = user;
    if (user) {
        loginBtn.classList.add('hidden');
        userInfoDiv.classList.remove('hidden');
        userInfoDiv.classList.add('flex');
        userNameSpan.textContent = user.displayName || user.email;
    } else {
        loginBtn.classList.remove('hidden');
        userInfoDiv.classList.add('hidden');
        userInfoDiv.classList.remove('flex');
        userNameSpan.textContent = '';
        syncStatusSpan.classList.add('opacity-0');
    }
}

// --- FIREBASE DATA SYNC (AUTOMATED) ---
function triggerAutoSave() {
    if (!currentUser) return;
    
    syncStatusSpan.textContent = 'Menyimpan...';
    syncStatusSpan.classList.remove('opacity-0');

    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
        const dataToSave = {
            portfolioLog: portfolioLog,
            savedSimulations: savedSimulations,
            initialEquity: document.getElementById('initial-equity').value,
            currentMarketPrices: currentMarketPrices,
            simulationReason: document.getElementById('sim-reason').value,
            defaultFeeBeli: defaultFeeBeli, // Save default buy fee
            defaultFeeJual: defaultFeeJual, // Save default sell fee
            updatedAt: new Date().toISOString()
        };

        try {
            const userDocRef = window.firebase.doc(window.firebase.db, "portfolios", currentUser.uid);
            await window.firebase.setDoc(userDocRef, dataToSave);
            syncStatusSpan.textContent = 'Tersimpan ✓';
            setTimeout(() => syncStatusSpan.classList.add('opacity-0'), 2000);
        } catch (error) {
            console.error("Error auto-saving data to Firestore: ", error);
            syncStatusSpan.textContent = 'Gagal menyimpan';
            syncStatusSpan.classList.add('text-red-500');
        }
    }, 1500);
}

async function loadDataFromFirebase() {
    if (!currentUser) return;

    try {
        const userDocRef = window.firebase.doc(window.firebase.db, "portfolios", currentUser.uid);
        const docSnap = await window.firebase.getDoc(userDocRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            portfolioLog = data.portfolioLog || [];
            savedSimulations = data.savedSimulations || [];
            document.getElementById('initial-equity').value = data.initialEquity || "100000000";
            currentMarketPrices = data.currentMarketPrices || {};
            document.getElementById('sim-reason').value = data.simulationReason || '';
            defaultFeeBeli = data.defaultFeeBeli !== undefined ? data.defaultFeeBeli : 0.11; // Load default buy fee
            defaultFeeJual = data.defaultFeeJual !== undefined ? data.defaultFeeJual : 0.11; // Load default sell fee
            
            // Update settings inputs with loaded defaults
            defaultFeeBeliInput.value = defaultFeeBeli;
            defaultFeeJualInput.value = defaultFeeJual;

            refreshAllApplicationData();
            showNotification('Data berhasil dimuat dari cloud!', 'Sukses');
        } else {
            showNotification('Selamat datang! Tidak ada data cloud yang ditemukan, Anda bisa mulai dari awal.');
            resetAllData();
        }
    } catch (error) {
        console.error("Error loading data from Firestore: ", error);
        showNotification(`Gagal memuat data: ${error.message}`, 'Error');
    }
}

// --- FUNGSI PENGAMBILAN HARGA REAL-TIME (DIPERBARUI DENGAN POLYGON.IO) ---
/**
 * Mengambil harga terakhir untuk kode saham tertentu dari API Polygon.io.
 * @param {string} stockCode - Kode saham (misal: 'BBCA').
 */
async function fetchRealTimePrice(stockCode) {
    if (isFetchingPrice) {
        showNotification("Harap tunggu panggilan API sebelumnya selesai.", "Info");
        return;
    }

    if (!POLYGON_API_KEY || POLYGON_API_KEY === "YOUR_API_KEY") {
        showNotification("Harap masukkan API Key Polygon.io Anda di file script.js.", "API Key Diperlukan");
        return;
    }

    const fetchBtn = document.querySelector(`.fetch-price-btn[data-code="${stockCode.toUpperCase()}"]`);
    const originalBtnContent = fetchBtn.innerHTML;
    
    try {
        isFetchingPrice = true;
        // Tampilkan status loading
        fetchBtn.innerHTML = `<svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        fetchBtn.disabled = true;

        // --- BARU: Menggunakan endpoint SNAPSHOT ---
        const url = `https://api.polygon.io/v3/snapshot?ticker.any_of=XIDX:${stockCode.toUpperCase()}&apiKey=${POLYGON_API_KEY}`;
        
        const response = await fetch(url);

        if (response.status === 429) {
            throw new Error("Batas panggilan API (5 per menit) tercapai. Harap tunggu sebentar.");
        }
        
        const data = await response.json();

        if (data.status !== "OK") {
             throw new Error(data.error || `Gagal mengambil data untuk '${stockCode.toUpperCase()}'.`);
        }

        if (data.results && data.results.length > 0) {
            const price = data.results[0].day.c; // 'c' adalah harga penutupan (close) harian
            const inputField = document.getElementById(`current-price-${stockCode.toUpperCase()}`);
            
            if (inputField) {
                inputField.value = price;
                inputField.dispatchEvent(new Event('input', { bubbles: true }));
            }
        } else {
            throw new Error(`Tidak ada data snapshot untuk '${stockCode.toUpperCase()}'. Pastikan kode saham benar.`);
        }

    } catch (error) {
        console.error(`Error fetching price for ${stockCode}:`, error);
        showNotification(error.message, "Error");
    } finally {
        // Kembalikan tombol ke keadaan semula
        if(fetchBtn) {
            fetchBtn.innerHTML = originalBtnContent;
            fetchBtn.disabled = false;
        }
        // Reset flag setelah 2 detik untuk memberi jeda
        setTimeout(() => {
            isFetchingPrice = false;
        }, 2000);
    }
}


// --- LOCAL JSON BACKUP/RESTORE ---
function downloadJSON() {
    const dataToSave = {
        portfolioLog: portfolioLog,
        savedSimulations: savedSimulations,
        initialEquity: document.getElementById('initial-equity').value,
        currentMarketPrices: currentMarketPrices,
        simulationReason: document.getElementById('sim-reason').value,
        defaultFeeBeli: defaultFeeBeli, // Include default fees in backup
        defaultFeeJual: defaultFeeJual, // Include default fees in backup
    };
    const dataStr = JSON.stringify(dataToSave, null, 2);
    const dataBlob = new Blob([dataStr], {type: "application/json"});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `portfolio_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Use custom confirmation modal instead of browser's confirm()
    showCustomConfirmModal(
        'Konfirmasi Pemulihan Data',
        'Ini akan menimpa data Anda saat ini. Lanjutkan?',
        'Lanjutkan',
        'Batal',
        () => {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data && typeof data === 'object') {
                        portfolioLog = data.portfolioLog || [];
                        savedSimulations = data.savedSimulations || [];
                        document.getElementById('initial-equity').value = data.initialEquity || "100000000";
                        currentMarketPrices = data.currentMarketPrices || {};
                        document.getElementById('sim-reason').value = data.simulationReason || '';
                        defaultFeeBeli = data.defaultFeeBeli !== undefined ? data.defaultFeeBeli : 0.11; // Load default buy fee
                        defaultFeeJual = data.defaultFeeJual !== undefined ? data.defaultFeeJual : 0.11; // Load default sell fee
                        
                        // Update settings inputs with loaded defaults
                        defaultFeeBeliInput.value = defaultFeeBeli;
                        defaultFeeJualInput.value = defaultFeeJual;

                        refreshAllApplicationData();
                        showNotification('Data berhasil dimuat dari file JSON!', 'Sukses');
                    } else {
                        throw new Error('Invalid JSON structure');
                    }
                } catch (error) {
                    showNotification(`Gagal memuat file: ${error.message}`, 'Error');
                } finally {
                    event.target.value = '';
                    closeModal(deleteConfirmModal); // Ensure modal closes after file load attempt
                }
            };
            reader.readAsText(file);
        }, 
        () => {
            event.target.value = ''; // Clear the file input if cancelled
            closeModal(deleteConfirmModal); // Close the modal if cancelled
        }
    );
}

// --- DATA MANAGEMENT ---
function resetAllData() {
    portfolioLog = [];
    savedSimulations = [];
    currentMarketPrices = {};
    document.getElementById('initial-equity').value = "100000000";
    document.getElementById('sim-reason').value = "";
    defaultFeeBeli = 0.11; // Reset default fees
    defaultFeeJual = 0.11; // Reset default fees
    defaultFeeBeliInput.value = defaultFeeBeli;
    defaultFeeJualInput.value = defaultFeeJual;
    refreshAllApplicationData();
}

function refreshAllApplicationData() {
    applyLogFiltersAndSort(); // Apply filters and sort on refresh
    renderFinancialSummaries();
    renderSavedSimulationsTable();
    calculateDashboard();
    calculateEntryForProfit();
    updateSimulationReasonDisplay();
    renderPerformanceTab(); // Call renderPerformanceTab directly
    triggerAutoSave();
}


// --- SIMULATOR CALCULATIONS & DISPLAY ---
function updateActiveSimDisplay() {
    const displayContainer = document.getElementById('active-sim-params-display');
    // NEW: Add strategy to the display
    const strategy = document.getElementById('avg-strategy').value === 'lot' ? 'Pengali Lot' : 'Pengali Total Beli';
    const multiplier = document.getElementById('avg-multiplier').value;

    displayContainer.innerHTML = `
        <div><span class="font-semibold text-gray-400">Kode:</span> <span class="text-cyan-300">${document.getElementById('stock-code').value.toUpperCase()}</span></div>
        <div><span class="font-semibold text-gray-400">Harga Awal:</span> ${formatCurrency(document.getElementById('initial-price').value)}</div>
        <div><span class="font-semibold text-gray-400">Lot Awal:</span> ${document.getElementById('initial-lot').value}</div>
        <div><span class="font-semibold text-gray-400">Avg. Down:</span> ${document.getElementById('avg-down-percent').value}%</div>
        <div class="md:col-span-2"><span class="font-semibold text-gray-400">Strategi AVG:</span> ${strategy} (x${multiplier})</div>
    `;
}

function updateSimulationReasonDisplay() {
    const reasonCard = document.getElementById('simulation-reason-card');
    const reasonDisplay = document.getElementById('simulation-reason-display');
    const reasonText = document.getElementById('sim-reason').value;

    if (reasonText && reasonText.trim() !== '') {
        reasonDisplay.textContent = reasonText;
        reasonCard.classList.remove('hidden');
    } else {
        reasonCard.classList.add('hidden');
    }
}

/**
 * REVISED FUNCTION
 * This function now calculates and displays the nominal profit for TP1 and TP2.
 */
function calculateDashboard() {
    // Get main parameters
    const initialPrice = parseFloat(document.getElementById('initial-price').value) || 0;
    const initialLot = parseFloat(document.getElementById('initial-lot').value) || 0;
    const dividend = parseFloat(document.getElementById('dividend').value) || 0;
    const avgDownPercent = parseFloat(document.getElementById('avg-down-percent').value) || 0;
    const avgLevels = parseInt(document.getElementById('avg-levels').value) || 0;
    const tp1Percent = parseFloat(document.getElementById('tp1-percent').value) || 0;
    const tp2Percent = parseFloat(document.getElementById('tp2-percent').value) || 0;

    // Get averaging strategy parameters
    const avgStrategy = document.getElementById('avg-strategy').value;
    const avgMultiplier = parseFloat(document.getElementById('avg-multiplier').value) || 1;
    const initialBuyAmount = initialPrice * initialLot * 100;

    const tableBody = document.getElementById('scenario-table-body');
    tableBody.innerHTML = ''; 
    
    let cumulativeCost = 0, cumulativeShares = 0, currentPrice = initialPrice;

    for (let i = 0; i <= avgLevels; i++) {
        let entryPrice, lotsToBuy;

        if (i === 0) {
            // Initial Entry
            entryPrice = initialPrice;
            lotsToBuy = initialLot;
        } else {
            // Averaging Down Levels
            entryPrice = currentPrice * (1 - avgDownPercent / 100);
            
            if (avgStrategy === 'lot') {
                // Strategy 1: Multiply the initial lot count
                lotsToBuy = initialLot * avgMultiplier;
            } else if (avgStrategy === 'amount') {
                // Strategy 2: Multiply the initial buy amount (in Rupiah)
                const targetAmount = initialBuyAmount * avgMultiplier;
                if (entryPrice > 0) {
                    const sharesToBuy = targetAmount / entryPrice;
                    lotsToBuy = Math.round(sharesToBuy / 100); // Round to the nearest whole lot
                } else {
                    lotsToBuy = 0;
                }
            } else {
                // Fallback to original logic
                lotsToBuy = initialLot;
            }
        }

        if (lotsToBuy <= 0 || entryPrice <= 0) continue;

        const sharesToBuy = lotsToBuy * 100;
        const totalBuy = entryPrice * sharesToBuy;
        cumulativeCost += totalBuy; 
        cumulativeShares += sharesToBuy;
        
        const avgPrice = cumulativeCost / cumulativeShares;
        const dividendYield = dividend > 0 && entryPrice > 0 ? (dividend / entryPrice) * 100 : 0;
        
        // TP Price Calculation
        const tp1Price = avgPrice * (1 + tp1Percent / 100);
        const tp2Price = avgPrice * (1 + tp2Percent / 100);

        // NEW: Nominal Profit Calculation
        const profitTp1 = (tp1Price - avgPrice) * cumulativeShares;
        const profitTp2 = (tp2Price - avgPrice) * cumulativeShares;
        
        const row = document.createElement('tr');
        row.className = 'bg-gray-800 border-b border-gray-700 hover:bg-gray-600';
        row.innerHTML = `
            <td class="px-6 py-4 font-medium whitespace-nowrap">${i === 0 ? 'Entry Awal' : `AVG ${i}`}</td>
            <td class="px-6 py-4 font-semibold text-yellow-300">${formatCurrency(entryPrice)}</td>
            <td class="px-6 py-4">${lotsToBuy}</td>
            <td class="px-6 py-4">${formatCurrency(totalBuy)}</td>
            <td class="px-6 py-4 ${dividendYield > 5 ? 'text-green-400' : 'text-gray-300'}">${dividendYield.toFixed(2)}%</td>
            <td class="px-6 py-4 font-semibold text-blue-300">${formatCurrency(avgPrice)}</td>
            <td class="px-6 py-4 text-green-400">${formatCurrency(tp1Price)}</td>
            <td class="px-6 py-4 font-semibold text-green-400">${formatCurrency(profitTp1, true)}</td>
            <td class="px-6 py-4 text-green-500">${formatCurrency(tp2Price)}</td>
            <td class="px-6 py-4 font-semibold text-green-500">${formatCurrency(profitTp2, true)}</td>
        `;
        tableBody.appendChild(row);
        
        currentPrice = entryPrice;
    }

    const totalInvestment = cumulativeCost;
    const totalLots = cumulativeShares / 100;
    const finalAvgPrice = totalInvestment / (totalLots * 100) || 0;
    document.getElementById('summary-total-investment').textContent = formatCurrency(totalInvestment);
    document.getElementById('summary-total-lot').textContent = totalLots;
    document.getElementById('summary-avg-price').textContent = formatCurrency(finalAvgPrice);
}


function calculateEntryForProfit() {
    const targetProfitRp = parseFloat(document.getElementById('target-profit-rp').value) || 0;
    const targetProfitLot = parseFloat(document.getElementById('target-profit-lot').value) || 0;
    const targetProfitPercent = parseFloat(document.getElementById('target-profit-percent').value) || 0;
    if (targetProfitLot <= 0 || targetProfitPercent <= 0) { document.getElementById('entry-price-result').textContent = 'Input tidak valid'; return; }
    const entryPrice = targetProfitRp / (targetProfitLot * 100 * (targetProfitPercent / 100));
    document.getElementById('entry-price-result').textContent = formatCurrency(entryPrice);
}

// --- PORTFOLIO LOG & SUMMARY MANAGEMENT ---
function renderLogTable(logsToRender = portfolioLog) {
    const logTableBody = document.getElementById('log-table-body');
    logTableBody.innerHTML = '';
    
    if (logsToRender.length === 0) { 
        logTableBody.innerHTML = `<tr><td colspan="11" class="text-center py-8 text-gray-500">Tidak ada catatan transaksi yang sesuai dengan filter.</td></tr>`; 
        return; 
    }
    
    logsToRender.forEach((log, index) => {
        const row = document.createElement('tr');
        row.className = 'bg-gray-800 border-b border-gray-700';
        let plHtml, statusHtml, actionHtml, sellDateHtml, feeJualDisplay;
        
        // Calculate realized P/L if sold
        const realizedPL = log.sellPrice
            ? ((log.sellPrice * (1 - (log.feeJual || 0) / 100)) - (log.price * (1 + (log.feeBeli || 0) / 100))) * log.lot * 100
            : null;
        
        if (log.sellPrice) {
            const plColor = realizedPL >= 0 ? 'text-green-400' : 'text-red-500';
            plHtml = `<td class="px-6 py-4 font-semibold ${plColor}">${formatCurrency(realizedPL, true)}</td>`;
            statusHtml = `<td class="px-6 py-4"><span class="px-2 py-1 text-xs font-medium rounded-full bg-gray-700 text-gray-300">Closed</span></td>`;
            actionHtml = `<td class="px-6 py-4 flex space-x-2">
                            <button class="edit-log-btn bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-3 rounded" data-index="${portfolioLog.indexOf(log)}">Edit</button>
                            <button class="delete-log-btn bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-1 px-3 rounded" data-index="${portfolioLog.indexOf(log)}">Hapus</button>
                          </td>`;
            sellDateHtml = `<td class="px-6 py-4">${log.sellDate}</td>`;
            feeJualDisplay = `<td class="px-6 py-4">${(log.feeJual || 0).toFixed(2)}%</td>`;
        } else {
            plHtml = `<td class="px-6 py-4 text-gray-500">-</td>`;
            statusHtml = `<td class="px-6 py-4"><span class="px-2 py-1 text-xs font-medium rounded-full bg-blue-900 text-blue-300">Open</span></td>`;
            actionHtml = `<td class="px-6 py-4 flex space-x-2">
                            <button class="sell-log-btn bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-1 px-3 rounded" data-index="${portfolioLog.indexOf(log)}">Jual</button>
                            <button class="edit-log-btn bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-3 rounded" data-index="${portfolioLog.indexOf(log)}">Edit</button>
                            <button class="delete-log-btn bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-1 px-3 rounded" data-index="${portfolioLog.indexOf(log)}">Hapus</button>
                          </td>`;
            sellDateHtml = `<td class="px-6 py-4 text-gray-500">-</td>`;
            feeJualDisplay = `<td class="px-6 py-4 text-gray-500">-</td>`; // Display '-' for open positions
        }
        
        row.innerHTML = `
            <td class="px-6 py-4">${log.date}</td>
            <td class="px-6 py-4 font-medium text-cyan-300">${log.code.toUpperCase()}</td>
            <td class="px-6 py-4">${formatCurrency(log.price)}</td>
            <td class="px-6 py-4">${log.lot}</td>
            <td class="px-6 py-4">${(log.feeBeli || 0).toFixed(2)}%</td>
            ${feeJualDisplay}
            <td class="px-6 py-4 text-gray-400">${log.reason || '-'}</td>
            ${statusHtml}
            ${sellDateHtml}
            ${plHtml}
            ${actionHtml}
        `;
        logTableBody.appendChild(row);
    });
    updateSortIcons();
}

// --- PERUBAHAN: renderFinancialSummaries ---
// Diperbarui untuk menambahkan tombol refresh harga
function renderFinancialSummaries() {
    const summaryContainer = document.getElementById('portfolio-summary-by-stock');
    const grandTotalContainer = document.getElementById('portfolio-grand-total');
    const realizedPlContainer = document.getElementById('realized-pl-summary');
    const currentEquityDisplay = document.getElementById('current-equity-display');
    
    summaryContainer.innerHTML = ''; grandTotalContainer.innerHTML = ''; realizedPlContainer.innerHTML = '';

    const initialEquity = parseFloat(document.getElementById('initial-equity').value) || 0;
    let totalBuyCostWithFee = 0;
    let totalSellValueWithFee = 0;
    
    portfolioLog.forEach(log => {
        const buyCost = log.price * log.lot * 100;
        totalBuyCostWithFee += buyCost * (1 + (log.feeBeli || 0) / 100);
        if(log.sellPrice) {
            const sellValue = log.sellPrice * log.lot * 100;
            totalSellValueWithFee += sellValue * (1 - (log.feeJual || 0) / 100);
        }
    });

    // Equity calculation now considers Fee for both buy and sell
    const currentEquity = initialEquity - totalBuyCostWithFee + totalSellValueWithFee;
    currentEquityDisplay.textContent = formatCurrency(currentEquity);

    const openPositions = portfolioLog.filter(log => !log.sellPrice);
    const closedPositions = portfolioLog.filter(log => log.sellPrice);
    
    if (openPositions.length === 0) {
        summaryContainer.innerHTML = `<p class="text-gray-500 text-center">Tidak ada posisi terbuka.</p>`;
        grandTotalContainer.innerHTML = `<div class="p-4 bg-gray-600 rounded-lg text-center"><h4 class="text-gray-300 font-medium">Total Investasi (Open)</h4><p class="text-2xl font-bold text-yellow-400 mt-1">${formatCurrency(0)}</p></div>`;
    } else {
        const summary = openPositions.reduce((acc, log) => {
            const code = log.code.toUpperCase();
            if (!acc[code]) { acc[code] = { totalLots: 0, totalCost: 0 }; }
            acc[code].totalLots += log.lot;
            // Store total cost with Fee for open positions
            acc[code].totalCost += (log.price * (1 + (log.feeBeli || 0) / 100)) * log.lot * 100;
            return acc;
        }, {});
        let grandTotalCost = 0;
        Object.entries(summary).forEach(([code, data]) => {
            grandTotalCost += data.totalCost;
            const avgPriceWithFee = data.totalCost / (data.totalLots * 100); // This avgPrice now includes Fee
            const priceValue = currentMarketPrices[code] || '';
            const summaryCard = document.createElement('div');
            summaryCard.className = 'p-4 bg-gray-700/50 rounded-lg';
            // --- PERUBAHAN DI SINI: Menambahkan tombol refresh ---
            summaryCard.innerHTML = `
                <h4 class="font-bold text-lg text-cyan-300">${code}</h4>
                <div class="flex justify-between text-sm mt-2">
                    <span class="text-gray-400">Total Lot:</span>
                    <span class="font-semibold">${data.totalLots}</span>
                </div>
                <div class="flex justify-between text-sm mt-1">
                    <span class="text-gray-400">Harga Rata-rata:</span>
                    <span class="font-semibold">${formatCurrency(avgPriceWithFee)}</span>
                </div>
                <div class="flex justify-between text-sm mt-1">
                    <span class="text-gray-400">Total Investasi:</span>
                    <span class="font-semibold">${formatCurrency(data.totalCost)}</span>
                </div>
                <div class="flex justify-between items-center text-sm mt-2">
                    <label for="current-price-${code}" class="text-gray-400">Harga Saat Ini:</label>
                    <div class="flex items-center">
                        <input type="number" id="current-price-${code}" data-code="${code}" class="current-price-input w-24 bg-gray-800 border border-gray-600 rounded p-1 text-right" placeholder="0" value="${priceValue}">
                        <button data-code="${code}" class="fetch-price-btn" title="Ambil Harga Real-time">
                            <svg class="h-4 w-4 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h5M20 20v-5h-5M4 4l5 5M20 20l-5-5"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="flex justify-between text-sm mt-1">
                    <span class="text-gray-400">Floating P/L:</span>
                    <span id="floating-pl-${code}" class="font-semibold">-</span>
                </div>`;
            // --- AKHIR PERUBAHAN ---
            summaryContainer.appendChild(summaryCard);
        });
        const grandTotalCard = document.createElement('div');
        grandTotalCard.className = 'p-4 bg-gray-600 rounded-lg text-center';
        grandTotalCard.innerHTML = `<h4 class="text-gray-300 font-medium">Total Investasi (Open)</h4><p class="text-2xl font-bold text-yellow-400 mt-1">${formatCurrency(grandTotalCost)}</p></div>`;
        grandTotalContainer.appendChild(grandTotalCard);
    }

    const totalRealizedPL = closedPositions.reduce((acc, log) => {
        const buyCostPerShare = log.price * (1 + (log.feeBeli || 0) / 100);
        const sellValuePerShare = log.sellPrice * (1 - (log.feeJual || 0) / 100);
        return acc + ((sellValuePerShare - buyCostPerShare) * log.lot * 100);
    }, 0);
    const realizedPlCard = document.createElement('div');
    realizedPlCard.className = 'p-4 bg-gray-600 rounded-lg text-center';
    const plColor = totalRealizedPL >= 0 ? 'text-green-400' : 'text-red-500';
    realizedPlCard.innerHTML = `<h4 class="text-gray-300 font-medium">Total Realisasi P/L</h4><p class="text-2xl font-bold ${plColor} mt-1">${formatCurrency(totalRealizedPL, true)}</p>`;
    realizedPlContainer.appendChild(realizedPlCard);
    
    calculateAndRenderFloatingPL();
    // renderPerformanceTab is called here, which in turn calls renderPerformanceChart
    renderPerformanceTab();
}

function calculateAndRenderFloatingPL() {
    const openPositions = portfolioLog.filter(log => !log.sellPrice);
    const floatingPlContainer = document.getElementById('floating-pl-summary');
    if (openPositions.length === 0) { floatingPlContainer.innerHTML = ''; renderPerformanceTab(); return; }
    
    const summary = openPositions.reduce((acc, log) => {
        const code = log.code.toUpperCase();
        if (!acc[code]) { acc[code] = { totalLots: 0, totalCost: 0 }; }
        acc[code].totalLots += log.lot;
        // Use actual buy price (including Fee Beli) for floating P/L calculation
        acc[code].totalCost += (log.price * (1 + (log.feeBeli || 0) / 100)) * log.lot * 100;
        return acc;
    }, {});

    let totalFloatingPL = 0;
    Object.entries(summary).forEach(([code, data]) => {
        const currentPriceInput = document.getElementById(`current-price-${code}`);
        if (!currentPriceInput) return;
        const currentPrice = parseFloat(currentPriceInput.value) || 0;
        const floatingPlElement = document.getElementById(`floating-pl-${code}`);
        if (currentPrice > 0) {
            const avgPriceWithFee = data.totalCost / (data.totalLots * 100);
            // Floating P/L is (current market price - average buy price with Fee) * shares
            const floatingPL = (currentPrice - avgPriceWithFee) * data.totalLots * 100;
            totalFloatingPL += floatingPL;
            const plColor = floatingPL >= 0 ? 'text-green-400' : 'text-red-500';
            floatingPlElement.className = `font-semibold ${plColor}`;
            floatingPlElement.textContent = formatCurrency(floatingPL, true);
        } else {
            floatingPlElement.textContent = '-';
        }
    });

    const plColor = totalFloatingPL >= 0 ? 'text-green-400' : 'text-red-500';
    floatingPlContainer.innerHTML = `<div class="p-4 bg-gray-600 rounded-lg text-center"><h4 class="text-gray-300 font-medium">Total Floating P/L</h4><p class="text-2xl font-bold ${plColor} mt-1">${formatCurrency(totalFloatingPL, true)}</p></div>`;
    // renderPerformanceTab is called here, which in turn calls renderPerformanceChart
    renderPerformanceTab();
}

// --- PERFORMANCE TAB MANAGEMENT ---
// Moved renderPerformanceChart definition before its calls
function renderPerformanceChart() {
    const ctx = document.getElementById('performanceChart').getContext('2d');
    const periods = ['1 Bulan', '3 Bulan', '6 Bulan', '9 Bulan', '12 Bulan', 'YTD', '3 Tahun', '5 Tahun', 'All Time'];
    
    const initialEquity = parseFloat(document.getElementById('initial-equity').value) || 0;
    let allTimeReturn = NaN;
    if (initialEquity > 0) {
        let totalBuyCostWithFee = 0, totalSellValueWithFee = 0;
        portfolioLog.forEach(log => {
            totalBuyCostWithFee += (log.price * (1 + (log.feeBeli || 0) / 100)) * log.lot * 100;
            if (log.sellPrice) totalSellValueWithFee += (log.sellPrice * (1 - (log.feeJual || 0) / 100)) * log.lot * 100;
        });
        const currentEquity = initialEquity - totalBuyCostWithFee + totalSellValueWithFee;
        const openPositions = portfolioLog.filter(log => !log.sellPrice);
        let valueOfOpenPositions = 0;
        const summary = openPositions.reduce((acc, log) => {
            const code = log.code.toUpperCase();
            if (!acc[code]) acc[code] = { totalLots: 0 };
            acc[code].totalLots += log.lot;
            return acc;
        }, {});
        Object.entries(summary).forEach(([code, data]) => {
            const currentPrice = currentMarketPrices[code] || 0;
            if (currentPrice > 0) valueOfOpenPositions += parseFloat(currentPrice) * data.totalLots * 100;
        });
        const currentTotalValue = currentEquity + valueOfOpenPositions;
        allTimeReturn = ((currentTotalValue / initialEquity) - 1) * 100;
    }

    const portfolioData = periods.map(p => p === 'All Time' && isFinite(allTimeReturn) ? allTimeReturn : null);
    const ihsgData = periods.map(p => {
        const input = document.querySelector(`.performance-ihsg-input[data-period="${p}"]`);
        return input ? (parseFloat(input.value) || null) : null;
    });

    if (performanceChart) {
        performanceChart.destroy();
    }

    performanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: periods,
            datasets: [
                {
                    label: 'Performa Portofolio (%)',
                    data: portfolioData,
                    backgroundColor: 'rgba(34, 211, 238, 0.6)',
                    borderColor: 'rgba(34, 211, 238, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Performa IHSG (%)',
                    data: ihsgData,
                    backgroundColor: 'rgba(74, 85, 104, 0.6)',
                    borderColor: 'rgba(74, 85, 104, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#9CA3AF' },
                    grid: { color: '#374151' }
                },
                x: {
                    ticks: { color: '#9CA3AF' },
                    grid: { color: '#374151' }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#D1D5DB' }
                }
            }
        }
    });
}

function renderPerformanceTab() {
    const tableBody = document.getElementById('performance-table-body');
    tableBody.innerHTML = '';

    const initialEquity = parseFloat(document.getElementById('initial-equity').value) || 0;
    if (initialEquity <= 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-gray-500">Masukkan modal awal untuk menghitung performa.</td></tr>`;
        if (performanceChart) performanceChart.destroy();
        return;
    }

    let totalBuyCostWithFee = 0, totalSellValueWithFee = 0;
    portfolioLog.forEach(log => {
        totalBuyCostWithFee += (log.price * (1 + (log.feeBeli || 0) / 100)) * log.lot * 100;
        if (log.sellPrice) totalSellValueWithFee += (log.sellPrice * (1 - (log.feeJual || 0) / 100)) * log.lot * 100;
    });
    const currentEquity = initialEquity - totalBuyCostWithFee + totalSellValueWithFee;

    const openPositions = portfolioLog.filter(log => !log.sellPrice);
    let valueOfOpenPositions = 0;
    const summary = openPositions.reduce((acc, log) => {
        const code = log.code.toUpperCase();
        if (!acc[code]) acc[code] = { totalLots: 0 };
        acc[code].totalLots += log.lot;
        return acc;
    }, {});

    Object.entries(summary).forEach(([code, data]) => {
        const currentPrice = currentMarketPrices[code] || 0;
        if (currentPrice > 0) valueOfOpenPositions += parseFloat(currentPrice) * data.totalLots * 100;
    });

    const currentTotalValue = currentEquity + valueOfOpenPositions;
    const allTimeReturn = ((currentTotalValue / initialEquity) - 1) * 100;

    const periods = ['1 Bulan', '3 Bulan', '6 Bulan', '9 Bulan', '12 Bulan', 'YTD', '3 Tahun', '5 Tahun', 'All Time'];

    periods.forEach(period => {
        const row = document.createElement('tr');
        row.className = 'bg-gray-800 border-b border-gray-700';
        const isAllTime = period === 'All Time';
        const portfolioPerformance = isAllTime ? allTimeReturn : NaN;
        const performanceCell = isAllTime && isFinite(portfolioPerformance) ? `<td class="px-6 py-4 font-semibold ${portfolioPerformance >= 0 ? 'text-green-400' : 'text-red-500'}">${portfolioPerformance.toFixed(2)}%</td>` : `<td class="px-6 py-4 text-gray-500">N/A</td>`;
        row.innerHTML = `<td class="px-6 py-4 font-medium">${period}</td>${performanceCell}<td class="px-6 py-4"><input type="number" class="performance-ihsg-input w-24 bg-gray-700 border border-gray-600 rounded p-1 text-right" data-period="${period}" placeholder="0.00"></td><td class="px-6 py-4 font-semibold" id="performance-diff-${period.replace(/\s+/g, '')}">-</td>`;
        tableBody.appendChild(row);
    });
    renderPerformanceChart();
}

function calculatePerformanceDifference() {
     const initialEquity = parseFloat(document.getElementById('initial-equity').value) || 0;
     if (initialEquity <= 0) return;

     let totalBuyCostWithFee = 0, totalSellValueWithFee = 0;
     portfolioLog.forEach(log => {
        totalBuyCostWithFee += (log.price * (1 + (log.feeBeli || 0) / 100)) * log.lot * 100;
        if (log.sellPrice) totalSellValueWithFee += (log.sellPrice * (1 - (log.feeJual || 0) / 100)) * log.lot * 100;
     });
     const currentEquity = initialEquity - totalBuyCostWithFee + totalSellValueWithFee;

     const openPositions = portfolioLog.filter(log => !log.sellPrice);
     let valueOfOpenPositions = 0;
     const summary = openPositions.reduce((acc, log) => {
        const code = log.code.toUpperCase();
        if (!acc[code]) acc[code] = { totalLots: 0 };
        acc[code].totalLots += log.lot;
        return acc;
     }, {});
     Object.entries(summary).forEach(([code, data]) => {
        const currentPrice = currentMarketPrices[code] || 0;
        if (currentPrice > 0) valueOfOpenPositions += parseFloat(currentPrice) * data.totalLots * 100;
     });
     const currentTotalValue = currentEquity + valueOfOpenPositions;
     const allTimeReturn = ((currentTotalValue / initialEquity) - 1) * 100;

     document.querySelectorAll('.performance-ihsg-input').forEach(input => {
        const period = input.dataset.period;
        const diffCell = document.getElementById(`performance-diff-${period.replace(/\s+/g, '')}`);
        const ihsgPerf = parseFloat(input.value);

        if (!isNaN(ihsgPerf) && period === 'All Time' && isFinite(allTimeReturn)) {
            const difference = allTimeReturn - ihsgPerf;
            diffCell.className = `px-6 py-4 font-semibold ${difference >= 0 ? 'text-green-400' : 'text-red-500'}`;
            diffCell.textContent = `${difference.toFixed(2)}%`;
        } else {
            diffCell.textContent = '-';
            diffCell.className = `px-6 py-4 font-semibold`;
        }
     });
     renderPerformanceChart();
}

// --- MODAL MANAGEMENT ---
function openModal(modal) { modal.classList.add('active'); }
function closeModal(modal) { modal.classList.remove('active'); }

function showNotification(message, title = 'Pemberitahuan') {
    document.getElementById('notification-title').textContent = title;
    document.getElementById('notification-message').textContent = message;
    openModal(notificationModal);
}

// Custom confirmation modal function
let confirmCallback = null;
let cancelCallback = null;

function showCustomConfirmModal(title, message, confirmButtonText, cancelButtonText, onConfirm, onCancel) {
    customConfirmTitle.textContent = title;
    customConfirmMessage.textContent = message;
    customConfirmBtn.textContent = confirmButtonText;
    customCancelBtn.textContent = cancelButtonText;
    confirmCallback = onConfirm;
    cancelCallback = onCancel;
    openModal(deleteConfirmModal); // Reusing the delete-confirm-modal structure
}

// --- EVENT HANDLERS ---
function handleAddOrEditLog(event) {
    event.preventDefault();
    const isEdit = logEditIndexInput.value !== '';
    const index = isEdit ? parseInt(logEditIndexInput.value) : -1;

    const newLog = {
        id: isEdit ? portfolioLog[index].id : Date.now(), // Preserve ID for edits
        code: document.getElementById('log-stock-code').value, 
        date: document.getElementById('log-buy-date').value,
        price: parseFloat(document.getElementById('log-buy-price').value), 
        lot: parseInt(document.getElementById('log-buy-lot').value),
        feeBeli: parseFloat(logFeeBeliInput.value), // Get Fee Beli
        reason: document.getElementById('log-reason').value, 
        sellPrice: null, 
        sellDate: null,
        feeJual: null // Initialize Fee Jual
    };

    // If editing a sold transaction, get sell details from the modal
    if (isEdit && portfolioLog[index].sellPrice !== null) {
        newLog.sellPrice = parseFloat(logSellPriceInput.value);
        newLog.sellDate = logSellDateInput.value;
        newLog.feeJual = parseFloat(logFeeJualInput.value);
    } else if (isEdit) { // If editing an open transaction, ensure sell details are cleared if they somehow exist
         newLog.sellPrice = null;
         newLog.sellDate = null;
         newLog.feeJual = null;
    }


    if (!newLog.code || !newLog.date || !newLog.price || !newLog.lot) { showNotification('Harap isi semua kolom yang wajib diisi.'); return; }
    
    // Calculate transaction cost including Fee Beli
    const transactionCost = newLog.price * newLog.lot * 100 * (1 + (newLog.feeBeli || 0) / 100);
    
    const initialEquity = parseFloat(document.getElementById('initial-equity').value) || 0;
    let totalBuyCostWithFee = 0, totalSellValueWithFee = 0;
    portfolioLog.forEach((log, i) => {
        if (isEdit && i === index) return; // Exclude current log being edited from calculation
        totalBuyCostWithFee += (log.price * (1 + (log.feeBeli || 0) / 100)) * log.lot * 100;
        if (log.sellPrice) totalSellValueWithFee += (log.sellPrice * (1 - (log.feeJual || 0) / 100)) * log.lot * 100;
    });
    const currentEquity = initialEquity - totalBuyCostWithFee + totalSellValueWithFee;

    // Check if adding this new transaction would exceed available equity
    if (!isEdit && transactionCost > currentEquity) {
        showNotification(`Transaksi gagal. Total pembelian (${formatCurrency(transactionCost)}) melebihi ekuitas yang tersedia (${formatCurrency(currentEquity)}).`);
        return;
    }

    if (isEdit) {
        portfolioLog[index] = newLog;
    } else {
        portfolioLog.push(newLog);
    }
    
    logForm.reset();
    closeModal(addLogModal);
    refreshAllApplicationData();
}

function handleDeleteLog(index) {
    showCustomConfirmModal(
        'Konfirmasi Hapus',
        'Apakah Anda yakin ingin menghapus catatan ini? Tindakan ini tidak dapat dibatalkan.',
        'Hapus',
        'Batal',
        () => {
            portfolioLog.splice(index, 1);
            refreshAllApplicationData();
            closeModal(deleteConfirmModal); // Close the confirmation modal after deletion
        }, 
        () => {
            closeModal(deleteConfirmModal); // Close the confirmation modal if cancelled
        }
    );
}

function handleEditLog(index) {
    const logToEdit = portfolioLog[index];
    if (logToEdit) {
        logModalTitle.textContent = 'Edit Catatan Transaksi';
        submitLogBtn.textContent = 'Simpan Perubahan';
        logEditIndexInput.value = index;

        // Populate common fields
        document.getElementById('log-stock-code').value = logToEdit.code;
        document.getElementById('log-buy-date').value = logToEdit.date;
        document.getElementById('log-buy-price').value = logToEdit.price;
        document.getElementById('log-buy-lot').value = logToEdit.lot;
        logFeeBeliInput.value = logToEdit.feeBeli || defaultFeeBeli; // Default Fee Beli

        document.getElementById('log-reason').value = logToEdit.reason;

        // Handle sell-specific fields visibility and population
        if (logToEdit.sellPrice !== null) {
            sellFieldsContainer.classList.remove('hidden');
            logSellPriceInput.value = logToEdit.sellPrice;
            logSellDateInput.value = logToEdit.sellDate;
            logFeeJualInput.value = logToEdit.feeJual || defaultFeeJual; // Default Fee Jual
        } else {
            sellFieldsContainer.classList.add('hidden');
            logSellPriceInput.value = '';
            logSellDateInput.value = '';
            logFeeJualInput.value = defaultFeeJual; // Set default for new sell
        }
        openModal(addLogModal);
    }
}

function handleSellSubmit(event) {
    event.preventDefault();
    const index = parseInt(document.getElementById('sell-log-index').value);
    const sellPrice = parseFloat(document.getElementById('sell-price').value);
    const sellDate = document.getElementById('sell-date').value;
    const feeJual = parseFloat(document.getElementById('sell-fee-jual').value); // Get Fee Jual from sell modal

    if (!isNaN(index) && sellPrice > 0 && sellDate) {
        portfolioLog[index].sellPrice = sellPrice;
        portfolioLog[index].sellDate = sellDate;
        portfolioLog[index].feeJual = feeJual; // Store Fee Jual
        closeModal(sellModal);
        refreshAllApplicationData();
    } else {
        showNotification('Harga jual dan tanggal tidak valid.');
    }
}

/**
 * REVISED FUNCTION
 * This function now also saves the new averaging strategy parameters.
 */
function handleSimParamsSubmit(event) {
    event.preventDefault();
    // Copy standard values
    document.getElementById('stock-code').value = document.getElementById('modal-stock-code').value;
    document.getElementById('initial-price').value = document.getElementById('modal-initial-price').value;
    document.getElementById('initial-lot').value = document.getElementById('modal-initial-lot').value;
    document.getElementById('dividend').value = document.getElementById('modal-dividend').value;
    document.getElementById('avg-down-percent').value = document.getElementById('modal-avg-down-percent').value;
    document.getElementById('avg-levels').value = document.getElementById('modal-avg-levels').value;
    document.getElementById('tp1-percent').value = document.getElementById('modal-tp1-percent').value;
    document.getElementById('tp2-percent').value = document.getElementById('modal-tp2-percent').value;
    document.getElementById('sim-reason').value = document.getElementById('modal-sim-reason').value;

    // NEW: Copy averaging strategy values
    document.getElementById('avg-strategy').value = document.getElementById('modal-avg-strategy').value;
    document.getElementById('avg-multiplier').value = document.getElementById('modal-avg-multiplier').value;
    
    calculateDashboard();
    updateActiveSimDisplay();
    updateSimulationReasonDisplay();
    closeModal(simParamsModal);
    triggerAutoSave();
}

/**
 * REVISED FUNCTION
 * This function now saves the averaging strategy along with other simulation parameters.
 */
function handleSaveSimulation(isFromModal = false) {
    const simulation = {
        id: Date.now(),
        stockCode: document.getElementById(isFromModal ? 'modal-stock-code' : 'stock-code').value,
        initialPrice: parseFloat(document.getElementById(isFromModal ? 'modal-initial-price' : 'initial-price').value),
        initialLot: parseFloat(document.getElementById(isFromModal ? 'modal-initial-lot' : 'initial-lot').value),
        dividend: parseFloat(document.getElementById(isFromModal ? 'modal-dividend' : 'dividend').value),
        avgDownPercent: parseFloat(document.getElementById(isFromModal ? 'modal-avg-down-percent' : 'avg-down-percent').value),
        avgLevels: parseInt(document.getElementById(isFromModal ? 'modal-avg-levels' : 'avg-levels').value),
        // NEW: Save strategy parameters
        avgStrategy: document.getElementById(isFromModal ? 'modal-avg-strategy' : 'avg-strategy').value,
        avgMultiplier: parseFloat(document.getElementById(isFromModal ? 'modal-avg-multiplier' : 'avg-multiplier').value),
        tp1Percent: parseFloat(document.getElementById(isFromModal ? 'modal-tp1-percent' : 'tp1-percent').value),
        tp2Percent: parseFloat(document.getElementById(isFromModal ? 'modal-tp2-percent' : 'tp2-percent').value),
        reason: document.getElementById(isFromModal ? 'modal-sim-reason' : 'sim-reason').value,
    };
    if (!simulation.stockCode) { 
        showNotification('Kode saham tidak boleh kosong untuk menyimpan simulasi.'); 
        return; 
    }
    savedSimulations.push(simulation);
    renderSavedSimulationsTable();
    if (isFromModal) closeModal(simParamsModal);
    switchTab('saved');
    triggerAutoSave();
}

/**
 * REVISED FUNCTION
 * This function now loads the saved averaging strategy when a simulation is loaded.
 */
function handleLoadOrDeleteSimulation(event) {
    const target = event.target;
    const simId = parseInt(target.dataset.id);
    if (isNaN(simId)) return;

    if (target.classList.contains('load-sim-btn')) {
        const simToLoad = savedSimulations.find(s => s.id === simId);
        if (simToLoad) {
            // Load standard parameters
            document.getElementById('stock-code').value = simToLoad.stockCode;
            document.getElementById('initial-price').value = simToLoad.initialPrice;
            document.getElementById('initial-lot').value = simToLoad.initialLot;
            document.getElementById('dividend').value = simToLoad.dividend;
            document.getElementById('avg-down-percent').value = simToLoad.avgDownPercent;
            document.getElementById('avg-levels').value = simToLoad.avgLevels;
            document.getElementById('tp1-percent').value = simToLoad.tp1Percent;
            document.getElementById('tp2-percent').value = simToLoad.tp2Percent;
            document.getElementById('sim-reason').value = simToLoad.reason || '';
            
            // NEW: Load strategy parameters and update both hidden and modal inputs
            const savedStrategy = simToLoad.avgStrategy || 'lot';
            const savedMultiplier = simToLoad.avgMultiplier || 1;
            
            document.getElementById('avg-strategy').value = savedStrategy;
            document.getElementById('avg-multiplier').value = savedMultiplier;
            document.getElementById('modal-avg-strategy').value = savedStrategy;
            document.getElementById('modal-avg-multiplier').value = savedMultiplier;

            calculateDashboard();
            updateActiveSimDisplay();
            updateSimulationReasonDisplay();
            switchTab('simulator');
            triggerAutoSave();
        }
    } else if (target.classList.contains('delete-sim-btn')) {
        // Use custom confirmation modal for deleting simulations
        showCustomConfirmModal(
            'Konfirmasi Hapus Simulasi',
            'Apakah Anda yakin ingin menghapus simulasi ini? Tindakan ini tidak dapat dibatalkan.',
            'Hapus',
            'Batal',
            () => {
                savedSimulations = savedSimulations.filter(s => s.id !== simId);
                renderSavedSimulationsTable();
                triggerAutoSave();
                closeModal(deleteConfirmModal);
            }, 
            () => {
                closeModal(deleteConfirmModal);
            }
        );
    }
}

/**
 * REVISED FUNCTION
 * This function now displays the saved averaging strategy in the table.
 */
function renderSavedSimulationsTable() {
    const tableBody = document.getElementById('saved-simulations-table-body');
    tableBody.innerHTML = '';
    if (savedSimulations.length === 0) { 
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-500">Belum ada simulasi yang disimpan.</td></tr>`; 
        return; 
    }
    savedSimulations.forEach(sim => {
        const row = document.createElement('tr');
        row.className = 'bg-gray-800 border-b border-gray-700 hover:bg-gray-600';
        
        // NEW: Format the strategy text for display
        const strategy = sim.avgStrategy || 'lot'; // Default to 'lot' if not defined
        const multiplier = sim.avgMultiplier || 1; // Default to 1 if not defined
        const strategyText = strategy === 'lot' ? `Lot x${multiplier}` : `Rp x${multiplier}`;

        row.innerHTML = `
            <td class="px-6 py-4 font-medium text-cyan-300">${sim.stockCode.toUpperCase()}</td>
            <td class="px-6 py-4">${formatCurrency(sim.initialPrice)}</td>
            <td class="px-6 py-4">${sim.initialLot}</td>
            <td class="px-6 py-4">${sim.avgDownPercent}%</td>
            <td class="px-6 py-4">${sim.avgLevels}</td>
            <td class="px-6 py-4">${strategyText}</td>
            <td class="px-6 py-4 space-x-2">
                <button class="load-sim-btn text-green-400 hover:text-green-300" data-id="${sim.id}">Muat</button>
                <button class="delete-sim-btn text-red-500 hover:text-red-400" data-id="${sim.id}">Hapus</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// --- LOG SORTING FUNCTIONS ---
function updateSortIcons() {
    document.querySelectorAll('#tab-content-log .sort-icon').forEach(icon => icon.textContent = '');
    if (sortState.column) {
        const currentHeader = document.querySelector(`#tab-content-log [data-sort="${sortState.column}"] .sort-icon`);
        if (currentHeader) {
            currentHeader.textContent = sortState.direction === 'asc' ? ' ▲' : ' ▼';
        }
    }
}

function handleLogSort(event) {
    const header = event.target.closest('.sortable');
    if (!header) return;

    const column = header.dataset.sort;
    if (sortState.column === column) {
        sortState.direction = sortState.direction === 'asc' ? 'desc' : (sortState.direction === 'desc' ? null : 'asc');
    } else {
        sortState.column = column;
        sortState.direction = 'asc';
    }

    if (sortState.direction === null) {
        sortState.column = null;
    }
    
    applyLogFiltersAndSort();
}

// --- SETTINGS MANAGEMENT ---
function saveSettings() {
    defaultFeeBeli = parseFloat(defaultFeeBeliInput.value);
    defaultFeeJual = parseFloat(defaultFeeJualInput.value);
    showNotification('Pengaturan default berhasil disimpan!', 'Sukses');
    triggerAutoSave(); // Save settings to Firebase
}

// --- FILTER LOGIC ---
function applyLogFiltersAndSort() {
    const dateFrom = filterDateFromInput.value;
    const dateTo = filterDateToInput.value;
    const stockCode = filterStockCodeInput.value.toLowerCase();
    const reason = filterReasonInput.value.toLowerCase();
    const status = filterStatusSelect.value;
    
    let filteredLogs = portfolioLog.filter(log => {
        const logDate = log.date;
        const logCode = log.code.toLowerCase();
        const logReason = log.reason ? log.reason.toLowerCase() : '';
        const logStatus = log.sellPrice ? 'closed' : 'open';

        // Date filter
        if (dateFrom && logDate < dateFrom) return false;
        if (dateTo && logDate > dateTo) return false;

        // Stock Code filter
        if (stockCode && !logCode.includes(stockCode)) return false;

        // Reason filter
        if (reason && !logReason.includes(reason)) return false;

        // Status filter
        if (status !== 'all' && logStatus !== status) return false;

        return true;
    });
    
    // Apply sorting after filtering
    if (sortState.column) {
        filteredLogs.sort((a, b) => {
            let aValue, bValue;
            
            // Handle specific sorting logic for each column
            switch (sortState.column) {
                case 'realizedPL':
                    aValue = a.sellPrice ? ((a.sellPrice * (1 - (a.feeJual || 0) / 100)) - (a.price * (1 + (a.feeBeli || 0) / 100))) * a.lot * 100 : (sortState.direction === 'asc' ? -Infinity : Infinity);
                    bValue = b.sellPrice ? ((b.sellPrice * (1 - (b.feeJual || 0) / 100)) - (b.price * (1 + (b.feeBeli || 0) / 100))) * b.lot * 100 : (sortState.direction === 'asc' ? -Infinity : Infinity);
                    break;
                case 'status':
                    aValue = a.sellPrice ? 'closed' : 'open';
                    bValue = b.sellPrice ? 'closed' : 'open';
                    break;
                case 'date':
                case 'sellDate':
                    // Handle cases where date is null
                    aValue = a[sortState.column] ? new Date(a[sortState.column]) : (sortState.direction === 'asc' ? new Date(0) : new Date(8640000000000000));
                    bValue = b[sortState.column] ? new Date(b[sortState.column]) : (sortState.direction === 'asc' ? new Date(0) : new Date(8640000000000000));
                    break;
                case 'code':
                case 'reason':
                    aValue = a[sortState.column];
                    bValue = b[sortState.column];
                    // Handle cases where reason is null
                    if (aValue === undefined || aValue === null) aValue = '';
                    if (bValue === undefined || bValue === null) bValue = '';
                    break;
                default: // Numeric columns like price and lot
                    aValue = a[sortState.column];
                    bValue = b[sortState.column];
                    if (aValue === undefined || aValue === null) aValue = 0;
                    if (bValue === undefined || bValue === null) bValue = 0;
                    break;
            }

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortState.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            } else if (aValue instanceof Date && bValue instanceof Date) {
                 return sortState.direction === 'asc' ? aValue.getTime() - bValue.getTime() : bValue.getTime() - aValue.getTime();
            }
             else {
                return sortState.direction === 'asc' ? aValue - bValue : bValue - aValue;
            }
        });
    }

    renderLogTable(filteredLogs);
}

function resetLogFilters() {
    filterDateFromInput.value = '';
    filterDateToInput.value = '';
    filterStockCodeInput.value = '';
    filterReasonInput.value = '';
    filterStatusSelect.value = 'all';
    sortState = { column: 'date', direction: 'desc' }; // Reset sort state
    applyLogFiltersAndSort(); // Re-render with all logs
}


// --- EVENT LISTENERS ---
document.getElementById('profit-calc-form').addEventListener('input', calculateEntryForProfit);
logForm.addEventListener('submit', handleAddOrEditLog); // Changed to handleAddOrEditLog
simParamsForm.addEventListener('submit', handleSimParamsSubmit);
sellForm.addEventListener('submit', handleSellSubmit);
document.getElementById('initial-equity').addEventListener('input', () => {
    renderFinancialSummaries();
    triggerAutoSave();
});

document.getElementById('open-add-log-modal-btn').addEventListener('click', () => {
    logModalTitle.textContent = 'Tambah Catatan Transaksi';
    submitLogBtn.textContent = 'Tambah';
    logEditIndexInput.value = ''; // Clear edit index
    logForm.reset(); // Clear form fields
    document.getElementById('log-buy-date').value = new Date().toISOString().split('T')[0]; // Set default date
    logFeeBeliInput.value = defaultFeeBeli; // Set default Fee Beli from settings
    sellFieldsContainer.classList.add('hidden'); // Hide sell fields when adding new
    logSellPriceInput.value = '';
    logSellDateInput.value = '';
    logFeeJualInput.value = defaultFeeJual; // Set default for new sell
    openModal(addLogModal);
});
document.getElementById('cancel-add-log-btn').addEventListener('click', () => closeModal(addLogModal));

document.getElementById('open-sim-params-modal-btn').addEventListener('click', () => {
    // Load existing main values into modal
    document.getElementById('modal-stock-code').value = document.getElementById('stock-code').value;
    document.getElementById('modal-initial-price').value = document.getElementById('initial-price').value;
    document.getElementById('modal-initial-lot').value = document.getElementById('initial-lot').value;
    document.getElementById('modal-dividend').value = document.getElementById('dividend').value;
    document.getElementById('modal-avg-down-percent').value = document.getElementById('avg-down-percent').value;
    document.getElementById('modal-avg-levels').value = document.getElementById('avg-levels').value;
    document.getElementById('modal-tp1-percent').value = document.getElementById('tp1-percent').value;
    document.getElementById('modal-tp2-percent').value = document.getElementById('tp2-percent').value;
    document.getElementById('modal-sim-reason').value = document.getElementById('sim-reason').value;
    
    // NEW: Load existing strategy values into modal
    document.getElementById('modal-avg-strategy').value = document.getElementById('avg-strategy').value;
    document.getElementById('modal-avg-multiplier').value = document.getElementById('avg-multiplier').value;

    openModal(simParamsModal);
});
document.getElementById('cancel-sim-params-btn').addEventListener('click', () => closeModal(simParamsModal));
document.getElementById('save-simulation-from-modal-btn').addEventListener('click', () => handleSaveSimulation(true));
document.getElementById('notification-ok-btn').addEventListener('click', () => closeModal(notificationModal));

document.getElementById('log-table-body').addEventListener('click', (event) => {
    if (event.target.classList.contains('delete-log-btn')) {
        // Find the actual index in portfolioLog array
        const logIndex = parseInt(event.target.dataset.index);
        handleDeleteLog(logIndex); // Call the new handler
    } else if (event.target.classList.contains('sell-log-btn')) {
        // Find the actual index in portfolioLog array
        const logIndex = parseInt(event.target.dataset.index);
        document.getElementById('sell-log-index').value = logIndex;
        document.getElementById('sell-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('sell-fee-jual').value = portfolioLog[logIndex].feeJual || defaultFeeJual; // Set default Fee Jual from settings
        openModal(sellModal);
    } else if (event.target.classList.contains('edit-log-btn')) { // New event listener for edit button
        // Find the actual index in portfolioLog array
        const logIndex = parseInt(event.target.dataset.index);
        handleEditLog(logIndex);
    }
});
document.getElementById('cancel-sell-btn').addEventListener('click', () => closeModal(sellModal));

// Event listeners for the new custom confirmation modal buttons
document.getElementById('confirm-delete-btn').addEventListener('click', () => {
    if (confirmCallback) {
        confirmCallback();
        confirmCallback = null; // Reset callback
        cancelCallback = null;
    }
});

document.getElementById('cancel-delete-btn').addEventListener('click', () => {
    if (cancelCallback) {
        cancelCallback();
        cancelCallback = null; // Reset callback
        confirmCallback = null;
    }
});

document.getElementById('saved-simulations-table-body').addEventListener('click', handleLoadOrDeleteSimulation);

Object.keys(tabButtons).forEach(key => {
    tabButtons[key].addEventListener('click', () => switchTab(key));
});

// --- PERUBAHAN: Event Listener untuk Ringkasan Portofolio ---
// Diperbarui untuk menangani klik pada tombol refresh dan input manual
document.getElementById('portfolio-summary-by-stock').addEventListener('click', (event) => {
    const fetchBtn = event.target.closest('.fetch-price-btn');
    if (fetchBtn) {
        const code = fetchBtn.dataset.code;
        fetchRealTimePrice(code);
    }
});

document.getElementById('portfolio-summary-by-stock').addEventListener('input', (event) => {
    if (event.target.classList.contains('current-price-input')) {
        const code = event.target.dataset.code;
        currentMarketPrices[code] = event.target.value;
        calculateAndRenderFloatingPL();
        triggerAutoSave();
    }
});


document.getElementById('tab-content-performance').addEventListener('input', (event) => {
     if (event.target.classList.contains('performance-ihsg-input')) {
        calculatePerformanceDifference();
    }
});

// --- SORTING EVENT LISTENER ---
document.querySelector('#tab-content-log table thead').addEventListener('click', (event) => {
    const header = event.target.closest('.sortable');
    if (header) {
        handleLogSort(event);
    }
});

// Event listeners for Settings tab
saveSettingsBtn.addEventListener('click', saveSettings);

// Event listeners for Filter section
filterApplyBtn.addEventListener('click', applyLogFiltersAndSort);
filterResetBtn.addEventListener('click', resetLogFilters);
filterDateFromInput.addEventListener('change', applyLogFiltersAndSort);
filterDateToInput.addEventListener('change', applyLogFiltersAndSort);
filterStockCodeInput.addEventListener('input', applyLogFiltersAndSort); // Apply filter on input for immediate feedback
filterReasonInput.addEventListener('input', applyLogFiltersAndSort); // Apply filter on input for immediate feedback
filterStatusSelect.addEventListener('change', applyLogFiltersAndSort);


// New listeners for Auth, Sync, and Backup
loginBtn.addEventListener('click', handleGoogleLogin);
logoutBtn.addEventListener('click', handleLogout);
downloadJsonBtn.addEventListener('click', downloadJSON);
uploadJsonInput.addEventListener('change', handleFileUpload);

// --- INITIALIZATION ---
window.addEventListener('load', () => {
    document.getElementById('log-buy-date').value = new Date().toISOString().split('T')[0];
    
    window.firebase.onAuthStateChanged(window.firebase.auth, (user) => {
        const wasNotLoggedIn = !currentUser;
        updateUIForAuthState(user);
        if (user && wasNotLoggedIn) {
            loadDataFromFirebase();
        }
    });

    refreshAllApplicationData();
    switchTab('simulator');
});
