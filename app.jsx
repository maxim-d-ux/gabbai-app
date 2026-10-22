<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>גבאי דיגיטלי</title>

  <!-- PWA & Mobile settings -->
  <meta name="theme-color" content="#1e40af" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

  <!-- React & Babel Frameworks -->
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

  <!-- Lucide Icons -->
  <script src="https://unpkg.com/lucide@latest"></script>

  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>

  <!-- Firebase SDK -->
  <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js"></script>

  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      background-color: #f8fafc;
    }
    .pb-safe {
      padding-bottom: env(safe-area-inset-bottom);
    }
  </style>
</head>
<body class="bg-slate-50 text-slate-900">
  <div id="root"></div>

  <script type="text/babel">
    const { useState, useEffect } = React;

    // Firebase Config - החיבור האישי שלך
    const firebaseConfig = {
      apiKey: "AIzaSyBUqAbZqg1PyccNq0kH_qcZRxocXvQnDRc",
      authDomain: "gabbaiapp-9f22e.firebaseapp.com",
      projectId: "gabbaiapp-9f22e",
      storageBucket: "gabbaiapp-9f22e.firebasestorage.app",
      messagingSenderId: "341456962238",
      appId: "1:341456962238:web:3314ab78afb0fa4252d4ef"
    };

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.firestore();

    function GabbaiApp() {
      const [activeTab, setActiveTab] = useState('reading');
      const [readingType, setReadingType] = useState('weekday'); // 'weekday' or 'special'
      const [worshippers, setWorshippers] = useState([]);
      const [history, setHistory] = useState([]);
      const [loading, setLoading] = useState(true);
      
      const [hebrewDate, setHebrewDate] = useState('טוען תאריך...');
      const [gregorianDate, setGregorianDate] = useState('');
      const [parasha, setParasha] = useState('');
      
      // Form States
      const [showAddForm, setShowAddForm] = useState(false);
      const [editingWorshipper, setEditingWorshipper] = useState(null);
      const [formData, setFormData] = useState({ name: '', status: 'ישראל', yahrzeit: '', notes: '' });

      // Load Hebcal Date
      useEffect(() => {
        const today = new Date();
        const formattedGregorian = today.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        setGregorianDate(formattedGregorian);

        fetch(`https://www.hebcal.com/converter?cfg=json&gy=${today.getFullYear()}&gm=${today.getMonth() + 1}&gd=${today.getDate()}&g2h=1`)
          .then(res => res.json())
          .then(data => {
            setHebrewDate(data.hebrew);
          })
          .catch(() => setHebrewDate('י"א בְּחֶשְׁוָן תְּשַׁפָ"ז'));

        fetch(`https://www.hebcal.com/shabbat?cfg=json&geonameid=281184&m=50`)
          .then(res => res.json())
          .then(data => {
            const parashaItem = data.items.find(item => item.category === 'parashat');
            if (parashaItem) setParasha(parashaItem.hebrew);
          })
          .catch(() => setParasha('לך-לך'));
      }, []);

      // Realtime Firebase Listener
      useEffect(() => {
        const unsubWorshippers = db.collection('worshippers').onSnapshot(snapshot => {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setWorshippers(docs);
          setLoading(false);
        });

        const unsubHistory = db.collection('history').orderBy('timestamp', 'desc').onSnapshot(snapshot => {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setHistory(docs);
        });

        return () => {
          unsubWorshippers();
          unsubHistory();
        };
      }, []);

      useEffect(() => {
        if (window.lucide) {
          window.lucide.createIcons();
        }
      }, [activeTab, showAddForm, worshippers]);

      const handleSaveWorshipper = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        if (editingWorshipper) {
          await db.collection('worshippers').doc(editingWorshipper.id).update({
            name: formData.name,
            status: formData.status,
            yahrzeit: formData.yahrzeit,
            notes: formData.notes
          });
        } else {
          await db.collection('worshippers').add({
            name: formData.name,
            status: formData.status,
            yahrzeit: formData.yahrzeit,
            notes: formData.notes,
            callCount: 0,
            lastCalled: null
          });
        }

        setFormData({ name: '', status: 'ישראל', yahrzeit: '', notes: '' });
        setEditingWorshipper(null);
        setShowAddForm(false);
      };

      const handleRecordAliya = async (worshipper, aliyahName) => {
        const newCount = (worshipper.callCount || 0) + 1;
        const now = new Date().toISOString();

        await db.collection('worshippers').doc(worshipper.id).update({
          callCount: newCount,
          lastCalled: now
        });

        await db.collection('history').add({
          worshipperId: worshipper.id,
          worshipperName: worshipper.name,
          aliyahName: aliyahName,
          dateHebrew: hebrewDate,
          timestamp: now
        });

        alert(`נרשמה עלייה ל${worshipper.name} (${aliyahName})`);
      };

      const handleDeleteWorshipper = async (id) => {
        if (confirm('האם למחוק מתפלל זה?')) {
          await db.collection('worshippers').doc(id).delete();
          setShowAddForm(false);
        }
      };

      return (
        <div className="min-h-screen flex flex-col max-w-md mx-auto bg-slate-100 shadow-xl relative pb-6">
          
          <!-- Header -->
          <header className="bg-gradient-to-r from-blue-800 to-indigo-900 text-white p-4 shadow-md">
            <div className="flex justify-between items-center mb-3">
              <h1 className="text-xl font-bold tracking-wide">גבאי דיגיטלי</h1>
              <span className="text-xs bg-emerald-500 text-white px-2 py-1 rounded-full font-medium shadow-sm">
                מחובר לענן
              </span>
            </div>

            <!-- Top Nav Tabs -->
            <nav className="grid grid-cols-5 gap-1 bg-blue-950/40 p-1 rounded-xl text-center text-xs">
              {[
                { id: 'reading', label: 'קריאה', icon: 'book-open' },
                { id: 'worshippers', label: 'מתפללים', icon: 'users' },
                { id: 'history', label: 'השלמה', icon: 'history' },
                { id: 'calendar', label: 'לוח שנה', icon: 'calendar' },
                { id: 'reports', label: 'דוחות', icon: 'bar-chart-3' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setShowAddForm(false); }}
                  className={`py-2 px-1 rounded-lg flex flex-col items-center gap-1 transition-all ${
                    activeTab === tab.id ? 'bg-white text-blue-900 font-bold shadow' : 'text-blue-100 hover:bg-white/10'
                  }`}
                >
                  <i data-lucide={tab.icon} className="w-4 h-4"></i>
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </header>

          <!-- Main Content View -->
          <main className="flex-1 p-4 overflow-y-auto">
            {showAddForm ? (
              /* Full Screen Form */
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-800">
                    {editingWorshipper ? 'עריכת מתפלל' : 'הוספת מתפלל חדש'}
                  </h2>
                  <div className="flex items-center gap-2">
                    {editingWorshipper && (
                      <button 
                        onClick={() => handleDeleteWorshipper(editingWorshipper.id)}
                        className="text-red-500 p-2 hover:bg-red-50 rounded-lg"
                      >
                        <i data-lucide="trash-2" className="w-5 h-5"></i>
                      </button>
                    )}
                    <button 
                      onClick={handleSaveWorshipper}
                      className="bg-blue-600 text-white font-bold px-4 py-2 rounded-xl text-sm shadow hover:bg-blue-700"
                    >
                      שמור
                    </button>
                    <button 
                      onClick={() => setShowAddForm(false)}
                      className="text-slate-400 p-2 hover:bg-slate-100 rounded-lg"
                    >
                      <i data-lucide="x
