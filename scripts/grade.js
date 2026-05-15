const https = require('https');

const sube1OgrenciListesi = [
  '234401037', '214201043', '224401034', '234401015', '234401020', '234401045', 
  '224401021', '224401003', '234401010', '234401006', '234401031', '234401041', 
  '234401039', '234401014', '234401043', '234401036', '234401024', '234401018', 
  '234401017', '234401008', '234401040', '234401032', '234401028', '224401018', 
  '234401033', '234404050', '234401025'
];

const sube2OgrenciListesi = [
  '224401024', '244401003', '244401001', '224401031', '234410001', '234401029', 
  '224404053', '201201071', '214404002', '234401009', '224401014', '234401005', 
  '224401013', '234401002', '234404046', '234401011', '224401015', '224401026', 
  '234404049'
];

const DEADLINES = {
  'hafta-1': new Date('2026-05-22T23:59:59+03:00').getTime(),
  'hafta-2': new Date('2026-05-29T23:59:59+03:00').getTime()
  // Diğer haftalar eklenebilir
};

const token = process.env.GH_TOKEN;
const prNumber = process.env.PR_NUMBER;
const repo = process.env.GITHUB_REPOSITORY; // e.g., emremutlu/git423-odevler

if (!token || !prNumber || !repo) {
  console.error('Eksik ortam değişkenleri!');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${token}`,
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'Node.js'
};

async function getPRFiles() {
  return new Promise((resolve, reject) => {
    https.get(`https://api.github.com/repos/${repo}/pulls/${prNumber}/files`, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function getPRDetails() {
  return new Promise((resolve, reject) => {
    https.get(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function addLabels(labels) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ labels });
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${repo}/issues/${prNumber}/labels`,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => resolve(JSON.parse(responseData)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  try {
    const files = await getPRFiles();
    const pr = await getPRDetails();
    
    // Klasör yapısından hafta ve şube bulma: Sube-1/Hafta-1/Irem-Meryem-Toprak/...
    let sube = null;
    let hafta = null;
    
    for (const file of files) {
      const parts = file.filename.split('/');
      if (parts.length >= 3 && parts[0].startsWith('Sube-')) {
        sube = parts[0];
        // Klasör Hafta-1 şeklinde geliyor, DEADLINES objesi hafta-1 kullanıyor
        hafta = parts[1].toLowerCase(); 
        break;
      }
    }

    const labelsToApply = [];

    // 1. ŞUBE KONTROLÜ
    if (sube) {
      if (sube === 'Sube-1') {
        labelsToApply.push('Şube 1');
      } else if (sube === 'Sube-2') {
        labelsToApply.push('Şube 2');
      }
    } else {
      labelsToApply.push('Yanlış Klasör Formatı');
    }

    // 2. ZAMAN KONTROLÜ
    const prTime = new Date(pr.created_at).getTime();
    
    if (hafta && DEADLINES[hafta]) {
      if (prTime <= DEADLINES[hafta]) {
        labelsToApply.push('Zamanında (100)');
      } else {
        labelsToApply.push('Geç Teslim (60)');
      }
    } else {
      labelsToApply.push('Tarih Belirsiz');
    }

    console.log(`Eklenecek Etiketler: ${labelsToApply.join(', ')}`);
    await addLabels(labelsToApply);
    
    // 3. OTOMATIK MERGE (YENI)
    console.log('PR otomatik olarak merge ediliyor...');
    await mergePR();
    
  } catch (error) {
    console.error('Hata oluştu:', error);
    process.exit(1);
  }
}

async function mergePR() {
  const url = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/pulls/${process.env.PR_NUMBER}/merge`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${process.env.GH_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      merge_method: 'merge',
      commit_title: `Otomatik Ödev Kabulü (PR #${process.env.PR_NUMBER})`
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Merge hatası: ${error.message}`);
  }
  console.log('PR başarıyla merge edildi.');
}

main();
