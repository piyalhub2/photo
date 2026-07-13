/********************************************************
 * TONIR GALLERY — FACE RECOGNITION
 * ধাপ ১: শুধু Detection টেস্ট
 *
 * এই ধাপে শুধু চেক করা হচ্ছে — ব্রাউজার ঠিকমতো ছবির মধ্যে মুখ
 * খুঁজে বের করতে পারছে কিনা। এখনও কারো নাম সেভ/মনে রাখা/suggest
 * করার কাজ শুরু হয়নি — সেটা পরের ধাপে (ধাপ ২) যোগ হবে।
 *
 * এটা কাজ করে face-api.js নামের একটা ফ্রি লাইব্রেরি দিয়ে, যেটা
 * ব্রাউজারেই (তোমার/ভিজিটরের কম্পিউটারে) চলে — কোনো সার্ভার বা
 * পেইড API লাগে না।
 ********************************************************/

(function () {
    // face-api.js এর AI মডেল ফাইল — পাবলিক CDN থেকে লোড হবে,
    // আমাদের নিজেদের হোস্ট করা লাগবে না
    const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

    let modelsLoaded = false;
    let modelsLoading = false;

    // মডেল একবারই লোড হবে (প্রথম যখন বাটনে ক্লিক করবে)
    async function ensureModelsLoaded(statusEl) {
        if (modelsLoaded) return true;
        if (modelsLoading) return false;
        modelsLoading = true;
        if (statusEl) statusEl.textContent = 'মডেল লোড হচ্ছে... (প্রথমবার একটু সময় নেবে)';
        try {
            await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
            modelsLoaded = true;
            if (statusEl) statusEl.textContent = 'মডেল লোড হয়ে গেছে ✓';
            return true;
        } catch (err) {
            console.error('Face model load failed:', err);
            if (statusEl) statusEl.textContent = '⚠️ মডেল লোড করতে সমস্যা হয়েছে — ইন্টারনেট কানেকশন চেক করো';
            return false;
        } finally {
            modelsLoading = false;
        }
    }

    // একটা img এলিমেন্টে যত মুখ আছে সব খুঁজে বের করে
    async function detectFacesInImage(imgEl) {
        const options = new faceapi.TinyFaceDetectorOptions({
            inputSize: 416,
            scoreThreshold: 0.5
        });
        return faceapi.detectAllFaces(imgEl, options);
    }

    // একটা detected face-এর box থেকে ছোট গোল/স্কোয়ার crop বানায় দেখানোর জন্য
    function cropFaceToCanvas(imgEl, box) {
        const pad = 0.15; // মুখের চারপাশে একটু বাড়তি জায়গা যাতে পুরো মুখ আসে
        const w = box.width;
        const h = box.height;
        const x = Math.max(0, box.x - w * pad);
        const y = Math.max(0, box.y - h * pad);
        const cw = w * (1 + pad * 2);
        const ch = h * (1 + pad * 2);

        const canvas = document.createElement('canvas');
        const size = 90;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgEl, x, y, cw, ch, 0, 0, size, size);
        return canvas;
    }

    async function runFaceDetectTest() {
        const btn = document.getElementById('faceDetectTestBtn');
        const statusEl = document.getElementById('faceDetectStatus');
        const resultsEl = document.getElementById('faceDetectResults');
        const imgEl = document.getElementById('tagPreviewImg');

        if (!btn || !statusEl || !resultsEl || !imgEl || !imgEl.src) return;

        if (typeof faceapi === 'undefined') {
            statusEl.textContent = '⚠️ face-api.js লাইব্রেরি লোড হয়নি, একটু পর আবার চেষ্টা করো';
            return;
        }

        btn.disabled = true;
        resultsEl.innerHTML = '';
        statusEl.textContent = '';

        const ok = await ensureModelsLoaded(statusEl);
        if (!ok) {
            btn.disabled = false;
            return;
        }

        statusEl.textContent = 'মুখ খোঁজা হচ্ছে...';
        try {
            const detections = await detectFacesInImage(imgEl);

            if (!detections || detections.length === 0) {
                statusEl.textContent = 'কোনো মুখ পাওয়া যায়নি 😕 (ছবিটা zoom out / angle এ থাকলে হতে পারে)';
            } else {
                statusEl.textContent = detections.length + ' টা মুখ পাওয়া গেছে ✓';
                detections.forEach(function (det) {
                    const canvas = cropFaceToCanvas(imgEl, det.box);
                    canvas.style.borderRadius = '8px';
                    canvas.style.border = '2px solid #3FA8FF';
                    resultsEl.appendChild(canvas);
                });
            }
        } catch (err) {
            console.error('Face detection error:', err);
            statusEl.textContent = '⚠️ ডিটেকশনে সমস্যা হয়েছে, কনসোলে দেখো';
        }

        btn.disabled = false;
    }

    document.addEventListener('DOMContentLoaded', function () {
        const btn = document.getElementById('faceDetectTestBtn');
        if (btn) btn.addEventListener('click', runFaceDetectTest);
    });
})();
