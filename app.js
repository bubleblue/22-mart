// app.js — Full-Stack Edition dengan Supabase

const { createApp, ref, computed, onMounted, watch, nextTick } = Vue;

// ============================================================
//  KONFIGURASI SUPABASE
//  Ganti 2 baris di bawah dengan nilai dari project Anda:
//  Supabase Dashboard → Project Settings → API
// ============================================================
const SUPABASE_URL      = 'https://ewtqiwsimtuipfcjzdcy.supabase.co';        // cth: https://abcxyz.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHFpd3NpbXR1aXBmY2p6ZGN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyODY3NzEsImV4cCI6MjEwNjg2Mjc3MX0.7nMCHhtwqf0yJeWQYvP1OPUEvhAdK4F3kU1uuM5MvYg';  // cth: eyJhbGciOiJIUzI1NiIs...

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

createApp({
    setup() {

        // ===== STATE NAVIGASI & LAYOUT =====
        const isMobile    = ref(window.innerWidth < 768);
        const sidebarOpen = ref(window.innerWidth >= 768);
        const activePage  = ref('dashboard');

        // Deteksi resize window (tablet/desktop rotasi layar)
        window.addEventListener('resize', () => {
            isMobile.value = window.innerWidth < 768;
            if (!isMobile.value) sidebarOpen.value = true;
        });

        // Class sidebar: overlay di mobile, collapse di desktop
        const sidebarClasses = computed(() => {
            if (isMobile.value) {
                return sidebarOpen.value
                    ? 'fixed inset-y-0 left-0 z-50 w-64 translate-x-0'
                    : 'fixed inset-y-0 left-0 z-50 w-64 -translate-x-full';
            }
            return sidebarOpen.value ? 'relative w-64' : 'relative w-16';
        });

        const menus = [
            { id: 'dashboard',    label: 'Dashboard',    icon: 'fa-solid fa-house' },
            { id: 'input-barang', label: 'Input Barang', icon: 'fa-solid fa-box-open' },
            { id: 'laporan',      label: 'Laporan',      icon: 'fa-solid fa-chart-bar' },
        ];

        const currentMenuLabel = computed(() =>
            menus.find(m => m.id === activePage.value)?.label || ''
        );

        const navigateTo = (id) => {
            activePage.value = id;
            if (isMobile.value) sidebarOpen.value = false;
        };

        // ===== STATE DATA =====
        const products     = ref([]);
        const transactions = ref([]);
        const isLoading    = ref(false);
        const isSaving     = ref(false);
        const errorMsg     = ref('');
        const dbConnected  = ref(false);

        // ===== LOAD DATA DARI SUPABASE =====
        const loadProducts = async () => {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('name');
            if (error) {
                errorMsg.value = 'Gagal memuat produk. Cek koneksi & konfigurasi Supabase.';
                dbConnected.value = false;
                return;
            }
            products.value    = data || [];
            dbConnected.value = true;
        };

        const loadTransactions = async () => {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(300);
            if (error) {
                errorMsg.value = 'Gagal memuat transaksi: ' + error.message;
                return;
            }
            transactions.value = data || [];
        };

        // ===== FORM INPUT BARANG =====
        const addForm    = ref({ name: '', stock: null, buyPrice: null, sellPrice: null });
        const addSuccess = ref(false);
        const searchQuery = ref('');

        const marginPersen = computed(() => {
            const b = addForm.value.buyPrice, s = addForm.value.sellPrice;
            if (!b || b === 0) return 0;
            return (((s - b) / b) * 100).toFixed(1);
        });

        const addProduct = async () => {
            if (!addForm.value.name.trim()) return alert('Nama barang tidak boleh kosong!');
            if ((addForm.value.sellPrice || 0) < (addForm.value.buyPrice || 0)) {
                if (!confirm('Harga jual lebih rendah dari harga beli (rugi). Lanjutkan?')) return;
            }

            isSaving.value = true;
            const { data, error } = await supabase.from('products').insert([{
                name:       addForm.value.name.trim(),
                stock:      addForm.value.stock     || 0,
                buy_price:  addForm.value.buyPrice  || 0,
                sell_price: addForm.value.sellPrice || 0,
            }]).select();
            isSaving.value = false;

            if (error) { errorMsg.value = 'Gagal menyimpan barang: ' + error.message; return; }

            // Tambah ke list lokal & urutkan
            products.value.push(data[0]);
            products.value.sort((a, b) => a.name.localeCompare(b.name));

            addForm.value = { name: '', stock: null, buyPrice: null, sellPrice: null };
            addSuccess.value = true;
            setTimeout(() => { addSuccess.value = false; }, 3000);
        };

        const deleteProduct = async (id) => {
            if (!confirm('Yakin ingin menghapus barang ini? Data akan terhapus permanen.')) return;
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) { errorMsg.value = 'Gagal menghapus: ' + error.message; return; }
            products.value = products.value.filter(p => p.id !== id);
        };

        // ===== EDIT STOK INLINE =====
        const editingId      = ref(null);
        const editStockValue = ref(0);

        const startEditStock = (product) => {
            editingId.value      = product.id;
            editStockValue.value = product.stock;
        };

        const saveEditStock = async (product) => {
            if (editStockValue.value < 0 || editStockValue.value === null) {
                return alert('Stok tidak boleh negatif!');
            }
            const { error } = await supabase
                .from('products')
                .update({ stock: editStockValue.value })
                .eq('id', product.id);
            if (error) { errorMsg.value = 'Gagal update stok: ' + error.message; return; }

            product.stock        = editStockValue.value;
            editingId.value      = null;
            editStockValue.value = 0;
        };

        const cancelEdit = () => {
            editingId.value      = null;
            editStockValue.value = 0;
        };

        const filteredProducts = computed(() => {
            if (!searchQuery.value.trim()) return products.value;
            return products.value.filter(p =>
                p.name.toLowerCase().includes(searchQuery.value.toLowerCase())
            );
        });

        // ===== KALKULASI RINGKASAN =====
        const grossIncome = computed(() =>
            transactions.value.reduce((s, t) => s + (t.total_sell || 0), 0)
        );
        const netIncome = computed(() =>
            transactions.value.reduce((s, t) => s + ((t.total_sell || 0) - (t.total_buy || 0)), 0)
        );
        const currentTotalStock = computed(() =>
            products.value.reduce((s, p) => s + (p.stock || 0), 0)
        );
        const todayTransactions = computed(() => {
            const today = new Date().toDateString();
            return transactions.value.filter(t =>
                new Date(t.created_at).toDateString() === today
            );
        });
        const totalItemsSold = computed(() =>
            todayTransactions.value.reduce((s, t) => s + (t.qty || 0), 0)
        );

        // ===== DIAGRAM DONUT (Chart.js) =====
        let chartInstance = null;

        const buildChart = () => {
            const canvas = document.getElementById('incomeChart');
            if (!canvas) return;
            if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

            const kotor  = grossIncome.value  || 10000000;   // demo 10 juta jika belum ada data
            const bersih = netIncome.value    || 8000000;    // demo 8 juta

            chartInstance = new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels: ['Penghasilan Kotor', 'Penghasilan Bersih'],
                    datasets: [{
                        data: [kotor, bersih],
                        backgroundColor:      ['#22c55e', '#ef4444'],
                        hoverBackgroundColor: ['#16a34a', '#dc2626'],
                        borderWidth: 3,
                        borderColor: '#ffffff',
                    }]
                },
                options: {
                    cutout: '72%',
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => ' ' + new Intl.NumberFormat('id-ID', {
                                    style: 'currency', currency: 'IDR', maximumFractionDigits: 0
                                }).format(ctx.parsed)
                            }
                        }
                    },
                    animation: { animateScale: true, animateRotate: true }
                }
            });
        };

        watch(activePage, async (page) => {
            if (page === 'dashboard') { await nextTick(); buildChart(); }
        });

        watch([grossIncome, netIncome], async () => {
            if (activePage.value === 'dashboard') { await nextTick(); buildChart(); }
        });

        // ===== FORMAT HELPERS =====
        const formatRupiah = (n) => new Intl.NumberFormat('id-ID', {
            style: 'currency', currency: 'IDR', maximumFractionDigits: 0
        }).format(n || 0);

        const formatTime = (iso) => iso
            ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            : '-';

        const formatDateTime = (iso) => iso
            ? new Date(iso).toLocaleString('id-ID', {
                day: '2-digit', month: '2-digit', year: '2-digit',
                hour: '2-digit', minute: '2-digit'
              })
            : '-';

        const currentDate = ref('');
        const updateDate = () => {
            currentDate.value = new Date().toLocaleDateString('id-ID', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            });
        };
        updateDate();
        setInterval(updateDate, 60000);

        // ===== INIT =====
        onMounted(async () => {
            isLoading.value = true;
            await Promise.all([loadProducts(), loadTransactions()]);
            isLoading.value = false;
            await nextTick();
            buildChart();
        });

        return {
            // Nav & layout
            isMobile, sidebarOpen, sidebarClasses, activePage, menus,
            currentMenuLabel, navigateTo,
            // State
            products, transactions, isLoading, isSaving, errorMsg, dbConnected,
            // Produk
            filteredProducts, searchQuery,
            addForm, addSuccess, marginPersen, addProduct, deleteProduct,
            // Edit stok
            editingId, editStockValue, startEditStock, saveEditStock, cancelEdit,
            // Kalkulasi
            grossIncome, netIncome, currentTotalStock, totalItemsSold, todayTransactions,
            // Util
            currentDate, formatRupiah, formatTime, formatDateTime,
        };
    }
}).mount('#app');