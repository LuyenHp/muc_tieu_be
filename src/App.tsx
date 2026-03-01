import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Star, RefreshCcw, Loader2, ChevronLeft, User, Plus, Trash2, Save, X, Search, Calendar, Gift, Trophy, Upload, Image as ImageIcon, Edit2, Volume2, VolumeX } from 'lucide-react';
import { type Task, type ChildInfo, fetchTasks, updateTaskStatus, fetchChildren, createChild, updateChildProfile } from './services/api';
import { compressImage } from './services/imageUtils';
import './index.css';

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const App: React.FC = () => {
  const [children, setChildren] = useState<{ name: string; avatarUrl?: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [childInfo, setChildInfo] = useState<ChildInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isNewWeek, setIsNewWeek] = useState(false);
  const [isMusicEnabled, setIsMusicEnabled] = useState(true); // Default to true
  const [hasInteracted, setHasInteracted] = useState(false);


  // Audio references to prevent re-creation
  const bgMusicRef = React.useRef<HTMLAudioElement | null>(null);
  const successSfxRef = React.useRef<HTMLAudioElement | null>(null);
  const goalSfxRef = React.useRef<HTMLAudioElement | null>(null);
  const [hasPlayedGoalSfx, setHasPlayedGoalSfx] = useState(false); // Tránh phát đi phát lại

  const initAudio = () => {
    // Chúng ta sẽ dùng các file local mà người dùng sẽ tự thêm vào public/audio/
    if (bgMusicRef.current && successSfxRef.current && goalSfxRef.current) return;

    // Nhạc nền
    const bg = new Audio('/audio/bg-music.mp3');
    bg.loop = true;
    bg.volume = 0.25;
    bgMusicRef.current = bg;

    // Âm thanh khi tích điểm thành công
    const sfx = new Audio('/audio/success.wav');
    successSfxRef.current = sfx;

    // Âm thanh khi đạt mục tiêu (80%)
    const goal = new Audio('/audio/goal.mp3');
    goalSfxRef.current = goal;
  };


  useEffect(() => {
    initAudio();

    // Global Interaction Unlock for Audio

    const handleFirstInteraction = () => {
      console.log("Detecting first interaction...");
      initAudio(); // Initialize objects right here!

      if (bgMusicRef.current && !hasInteracted && isMusicEnabled) {
        bgMusicRef.current.play()
          .then(() => {
            setHasInteracted(true);
            console.log("Audio Unlocked & Playing!");
          })
          .catch(e => {
            console.error("Audio play failed even with gesture:", e);
            // Fallback for some browsers: try again on next interaction
          });
      }

      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [hasInteracted, isMusicEnabled]);

  useEffect(() => {
    if (isMusicEnabled && bgMusicRef.current && hasInteracted) {
      bgMusicRef.current.play().catch(() => { });
    } else if (bgMusicRef.current) {
      bgMusicRef.current.pause();
    }
  }, [isMusicEnabled, hasInteracted]);

  // Form state (Used for both add and edit)
  const [formName, setFormName] = useState('');
  const [formTasks, setFormTasks] = useState<{ title: string; imageUrl: string }[]>([
    { title: '', imageUrl: '' }
  ]);
  const [formInfo, setFormInfo] = useState<ChildInfo>({
    startDate: '',
    endDate: '',
    rewardName: '',
    rewardImage: '',
    avatarUrl: ''
  });

  const loadChildren = async () => {
    setLoading(true);
    try {
      const list = await fetchChildren();
      setChildren(list);
    } catch (error) {
      console.error('Failed to fetch children', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChildren();
  }, []);

  const loadChildData = async (name: string) => {
    setLoading(true);
    try {
      const result = await fetchTasks(name);
      setTasks(result.tasks);
      setChildInfo(result.info);
    } catch (error) {
      console.error('Failed to fetch tasks', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedChild) {
      loadChildData(selectedChild);
    }
  }, [selectedChild]);

  const toggleTask = async (taskId: number, dayIndex: number) => {
    if (!selectedChild) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newValue = !task.progress[dayIndex];
    const newTasks = tasks.map(t => {
      if (t.id === taskId) {
        const newProgress = [...t.progress];
        newProgress[dayIndex] = newValue;
        return { ...t, progress: newProgress };
      }
      return t;
    });

    setTasks(newTasks);

    // Tính toán phần trăm mới để kiểm tra đạt mục tiêu
    const newDone = newTasks.reduce((acc, t) => acc + t.progress.filter(v => v).length, 0);
    const newPercentage = (newDone / (newTasks.length * 6)) * 100;

    try {
      if (newValue) {
        initAudio();
        // Phát âm thanh tích điểm
        if (successSfxRef.current) {
          successSfxRef.current.currentTime = 0;
          successSfxRef.current.play().catch(() => { });
        }

        // Phát âm thanh đạt mục tiêu nếu vượt ngưỡng 80% lần đầu
        if (newPercentage >= 80 && !hasPlayedGoalSfx) {
          if (goalSfxRef.current) {
            goalSfxRef.current.currentTime = 0;
            goalSfxRef.current.play().catch(() => { });
          }
          setHasPlayedGoalSfx(true);
        } else if (newPercentage < 80) {
          setHasPlayedGoalSfx(false);
        }
      }
      await updateTaskStatus(selectedChild, taskId, dayIndex, newValue);

    } catch (error) {
      console.error('Update failed', error);
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          const newProgress = [...t.progress];
          newProgress[dayIndex] = !newValue;
          return { ...t, progress: newProgress };
        }
        return t;
      }));
    }
  };

  const resetWeek = () => {
    if (!selectedChild || !childInfo) return;
    // Mở form chỉnh sửa nhưng với tiêu đề "Tuần Mới" để user cập nhật thông tin
    setFormName(selectedChild);
    setFormTasks(tasks.map(t => ({ title: t.title, imageUrl: t.imageUrl })));
    setFormInfo({
      startDate: '', // Cần thiết lập lại ngày cho tuần mới
      endDate: '',
      rewardName: '', // Phần thưởng mỗi tuần sẽ khác
      rewardImage: ''
    });
    setIsNewWeek(true);
    setIsEditing(true);
  };

  const handleImageUpload = async (file: File, callback: (base64: string) => void) => {
    try {
      const base64 = await compressImage(file);
      callback(base64);
    } catch (error) {
      console.error('Image upload failed', error);
      alert('Không thể xử lý ảnh này');
    }
  };

  const startEditing = () => {
    if (!selectedChild || !childInfo) return;
    setFormName(selectedChild);
    setFormTasks(tasks.map(t => ({ title: t.title, imageUrl: t.imageUrl })));
    setFormInfo(childInfo);
    setIsNewWeek(false);
    setIsEditing(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) { alert('Vui lòng nhập tên bé'); return; }
    const validTasks = formTasks.filter(t => t.title.trim());
    if (validTasks.length === 0) { alert('Vui lòng nhập ít nhất 1 mục tiêu'); return; }

    setLoading(true);
    try {
      if (isEditing) {
        await updateChildProfile(formName, validTasks, formInfo, !isNewWeek);
        alert(isNewWeek ? 'Đã thiết lập tuần mới!' : 'Đã cập nhật cấu hình!');
        setIsEditing(false);
        setIsNewWeek(false);
        loadChildData(formName);
      } else {
        await createChild(formName, validTasks, formInfo);
        alert('Đã tạo bé mới thành công!');
        setIsAddingChild(false);
        loadChildren();
      }
      // Reset form
      setFormName('');
      setFormTasks([{ title: '', imageUrl: '' }]);
      setFormInfo({ startDate: '', endDate: '', rewardName: '', rewardImage: '', avatarUrl: '' });
    } catch (error) {
      console.error('Submit failed', error);
      alert('Lỗi khi lưu thông tin');
    } finally {
      setLoading(false);
    }
  };

  const allowedChildren = ['Lê Nhật An', 'Lê Tuệ Minh'];
  const filteredChildren = children.filter(child =>
    allowedChildren.includes(child.name) && child.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPossible = tasks.length * 6;
  const currentDone = tasks.reduce((acc, task) => acc + task.progress.filter(v => v).length, 0);
  const percentage = totalPossible > 0 ? (currentDone / totalPossible) * 100 : 0;
  const isGoalReached = percentage >= 80;

  if (loading && !selectedChild && !isAddingChild && !isEditing) {
    return (
      <div className="app-container" style={{ justifyContent: 'center' }}>
        <Loader2 className="animate-spin" size={64} color="var(--primary)" />
        <p>Đang tải danh sách...</p>
      </div>
    );
  }

  // Form View (Add/Edit)
  if (isAddingChild || isEditing) {
    return (
      <div className="app-container" style={{ height: '100vh', overflowY: 'auto', padding: '40px 20px', display: 'block' }}>
        <motion.div
          className="card magical-card"
          initial={{ scale: 0.8, opacity: 0, rotate: -2 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", damping: 12, stiffness: 100 }}
          style={{ width: '100%', maxWidth: '800px', position: 'relative', margin: 'auto', padding: '40px', border: '8px solid white' }}
        >
          <button
            style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            onClick={() => { setIsAddingChild(false); setIsEditing(false); setIsNewWeek(false); }}
          >
            <X size={24} color="#666" />
          </button>

          <h2 style={{ marginBottom: '30px', color: 'var(--primary)', textAlign: 'center', fontSize: '2.5rem', fontWeight: 900, textShadow: '2px 2px 0 white' }}>
            {isAddingChild ? 'Thêm Bé Mới 🧚✨' : (isNewWeek ? `Tuần Mới: ${formName} 🚀` : `Sửa Bé: ${formName} 🛠️`)}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginBottom: '30px' }}>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 800, fontSize: '1.1rem', color: '#555' }}>Tên của bé:</label>
              <input
                className="btn-kid"
                style={{ width: '100%', border: '4px solid #eee', background: isEditing ? '#f0f0f0' : 'white', cursor: isEditing ? 'not-allowed' : 'text', justifyContent: 'flex-start', padding: '15px 25px', textTransform: 'none' }}
                value={formName}
                onChange={e => !isEditing && setFormName(e.target.value)}
                disabled={isEditing}
                placeholder="Nhập tên bé..."
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 800, fontSize: '1.1rem', color: '#555' }}>Phần thưởng:</label>
              <input
                className="btn-kid"
                style={{ width: '100%', border: '4px solid #eee', background: 'white', cursor: 'text', justifyContent: 'flex-start', padding: '15px 25px', textTransform: 'none' }}
                placeholder="VD: Chuyến đi công viên 🎡"
                value={formInfo.rewardName}
                onChange={e => setFormInfo({ ...formInfo, rewardName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 800, fontSize: '1.1rem', color: '#555' }}>Ngày bắt đầu:</label>
              <input type="date" className="btn-kid" style={{ width: '100%', border: '4px solid #eee', background: 'white', cursor: 'text', justifyContent: 'flex-start', padding: '15px 25px' }} value={formInfo.startDate} onChange={e => setFormInfo({ ...formInfo, startDate: e.target.value })} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 800, fontSize: '1.1rem', color: '#555' }}>Ngày kết thúc:</label>
              <input type="date" className="btn-kid" style={{ width: '100%', border: '4px solid #eee', background: 'white', cursor: 'text', justifyContent: 'flex-start', padding: '15px 25px' }} value={formInfo.endDate} onChange={e => setFormInfo({ ...formInfo, endDate: e.target.value })} />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: '15px', fontWeight: 800, fontSize: '1.1rem', color: '#555' }}>Ảnh đại diện của bé:</label>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', background: '#f9f9f9', padding: '15px', borderRadius: '30px', border: '3px dashed #ddd' }}>
                <label className="btn-kid" style={{ cursor: 'pointer', background: 'var(--secondary)', color: 'white', borderBottom: '6px solid #3ca9a0', padding: '12px 25px' }}>
                  <Upload size={24} /> Chọn ảnh đẹp nhất
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], base64 => setFormInfo({ ...formInfo, avatarUrl: base64 }))} />
                </label>
                {formInfo.avatarUrl ? (
                  <motion.img initial={{ scale: 0 }} animate={{ scale: 1 }} src={formInfo.avatarUrl} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '4px solid white', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }} />
                ) : (
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={40} color="#ccc" /></div>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '35px' }}>
            <label style={{ display: 'block', marginBottom: '15px', fontWeight: 800, fontSize: '1.2rem', color: '#444' }}>Ảnh phần thưởng (Kích thích bé):</label>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', background: '#FFF9E6', padding: '20px', borderRadius: '35px', border: '3px dashed var(--accent)' }}>
              <label className="btn-kid" style={{ cursor: 'pointer', background: 'var(--accent)', color: 'var(--text)', borderBottom: '6px solid #e6ce4d', padding: '12px 25px' }}>
                <Upload size={24} /> Tải ảnh Quà 🎁
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], base64 => setFormInfo({ ...formInfo, rewardImage: base64 }))} />
              </label>
              {formInfo.rewardImage ? (
                <motion.img initial={{ scale: 0 }} animate={{ scale: 1 }} src={formInfo.rewardImage} style={{ width: '100px', height: '100px', borderRadius: '20px', objectFit: 'cover', border: '5px solid white', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }} />
              ) : (
                <div style={{ width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.5)', borderRadius: '20px' }}><Gift size={50} color="#ddd" /></div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <label style={{ fontWeight: 900, fontSize: '1.5rem', color: 'var(--primary)' }}>Mục tiêu nhiệm vụ 🏆</label>
              {formTasks.length < 5 && (
                <button
                  onClick={() => setFormTasks([...formTasks, { title: '', imageUrl: '' }])}
                  style={{ color: 'var(--secondary)', background: 'white', border: '3px solid var(--secondary)', borderRadius: '50px', padding: '8px 20px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Plus size={20} /> Thêm mục tiêu
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gap: '20px' }}>
              {formTasks.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(0,0,0,0.02)', borderRadius: '20px', border: '2px dashed #ccc' }}>
                  <p style={{ color: '#888', marginBottom: '10px' }}>Chưa có nhiệm vụ nào...</p>
                  <button
                    className="btn-kid"
                    style={{ background: 'var(--secondary)', color: 'white', display: 'inline-flex', padding: '10px 20px' }}
                    onClick={() => setFormTasks([{ title: '', imageUrl: '' }])}
                  >
                    <Plus size={20} /> THÊM NGAY
                  </button>
                </div>
              )}
              {formTasks.map((task, index) => (
                <motion.div
                  key={index}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  style={{ background: '#f5f7ff', padding: '20px', borderRadius: '30px', border: '3px solid #eef1ff', position: 'relative' }}
                >
                  <button onClick={() => setFormTasks(formTasks.filter((_, i) => i !== index))} style={{ position: 'absolute', top: '-10px', right: '-10px', width: '30px', height: '30px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}><Trash2 size={16} /></button>

                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <input
                        className="btn-kid"
                        style={{ width: '100%', border: '3px solid white', background: 'white', cursor: 'text', justifyContent: 'flex-start', padding: '12px 20px', textTransform: 'none', marginBottom: '10px', fontSize: '1rem' }}
                        placeholder="Tên nhiệm vụ (VD: Đánh răng sạch sẽ)"
                        value={task.title}
                        onChange={e => { const u = [...formTasks]; u[index].title = e.target.value; setFormTasks(u); }}
                      />
                      <label className="btn-kid" style={{ cursor: 'pointer', background: 'white', color: '#666', fontSize: '0.9rem', padding: '8px 15px', border: '3px solid white', display: 'flex', justifyContent: 'flex-start', width: 'fit-content' }}>
                        <ImageIcon size={18} /> {task.imageUrl ? 'Đổi ảnh minh họa' : 'Thêm ảnh minh họa'}
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], base64 => { const u = [...formTasks]; u[index].imageUrl = base64; setFormTasks(u); })} />
                      </label>
                    </div>
                    <div style={{ width: '90px', height: '90px', background: 'white', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid white', overflow: 'hidden', boxShadow: '0 5px 10px rgba(0,0,0,0.05)' }}>
                      {task.imageUrl ? (
                        <img src={task.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <ImageIcon size={32} color="#ddd" />
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <button
            className="btn-kid"
            style={{ width: '100%', background: 'var(--success)', color: 'white', borderBottom: '8px solid #4a9e52', fontSize: '1.5rem', padding: '20px' }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" size={28} /> : <Save size={28} />}
            <span style={{ marginLeft: '10px' }}>{isEditing ? 'HOÀN TẤT THAY ĐỔI ✨' : 'LƯU KẾ HOẠCH MA THUẬT ✨'}</span>
          </button>
        </motion.div>
      </div>
    );
  }

  // Selection Screen
  if (!selectedChild) {
    return (
      <div className="app-container" style={{ overflowY: 'auto', padding: '20px' }}>
        <motion.h1
          className="vibrant-gradient"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 10, stiffness: 100 }}
          style={{ fontSize: '3.5rem', margin: '40px 0', textShadow: '0 4px 15px rgba(255,107,107,0.3)', textAlign: 'center' }}
        >
          Bé Ngoan Mỗi Ngày 🌟
        </motion.h1>

        <motion.div
          style={{ width: '100%', maxWidth: '600px', position: 'relative', marginBottom: '40px' }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Search style={{ position: 'absolute', left: '20px', top: '15px', color: '#999' }} />
          <input
            className="search-input"
            style={{ paddingLeft: '60px', borderRadius: '50px', height: '60px', fontSize: '1.2rem', border: '4px solid white', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}
            placeholder="Tìm tên bé yêu..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </motion.div>

        <motion.div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '40px', width: '100%', maxWidth: '1100px' }}
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: { staggerChildren: 0.1 }
            }
          }}
          initial="hidden"
          animate="show"
        >
          {filteredChildren.map(child => (
            <motion.div
              key={child.name}
              variants={{
                hidden: { y: 20, opacity: 0 },
                show: { y: 0, opacity: 1 }
              }}
              whileHover={{ scale: 1.05, rotate: 2 }}
              whileTap={{ scale: 0.95 }}
              className="card magical-card"
              onClick={() => setSelectedChild(child.name)}
              style={{ textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '30px', border: '6px solid white' }}
            >
              <div style={{ position: 'relative' }}>
                {child.avatarUrl ? (
                  <img src={child.avatarUrl} alt={child.name} style={{ width: '130px', height: '130px', borderRadius: '50%', objectFit: 'cover', border: '6px solid white', boxShadow: '0 8px 20px rgba(0,0,0,0.15)' }} />
                ) : (
                  <div style={{ width: '130px', height: '130px', borderRadius: '50%', background: 'var(--secondary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 15px rgba(78, 205, 196, 0.3)' }}>
                    <User size={64} />
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: '0', right: '0', background: 'var(--accent)', color: 'var(--text)', padding: '8px', borderRadius: '50%', border: '3px solid white', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                  <Star size={18} fill="currentColor" />
                </div>
              </div>
              <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', textShadow: '2px 2px 0 white' }}>{child.name}</span>
            </motion.div>
          ))}

          <motion.div
            variants={{
              hidden: { y: 20, opacity: 0 },
              show: { y: 0, opacity: 1 }
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="card"
            onClick={() => { setIsAddingChild(true); setFormName(''); setFormTasks([{ title: '', imageUrl: '' }]); setFormInfo({ startDate: '', endDate: '', rewardName: '', rewardImage: '', avatarUrl: '' }); }}
            style={{ textAlign: 'center', cursor: 'pointer', border: '6px dashed rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '30px' }}
          >
            <div style={{ background: 'white', padding: '25px', borderRadius: '50%', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}>
              <Plus size={64} color="var(--primary)" />
            </div>
            <span style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--primary)' }}>Thêm Bé</span>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ padding: '20px' }}>
      <motion.div
        className="split-layout"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* CỘT TRÁI: THÔNG TIN BÉ & PHẦN THƯỞNG */}
        <div className="left-panel">
          <motion.div
            className="card magical-card"
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: "spring", damping: 15 }}
            style={{ width: '100%', padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center', textAlign: 'center', flexShrink: 0, border: '6px solid white' }}
          >
            <div style={{ display: 'flex', gap: '10px', alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn-kid" onClick={() => setSelectedChild(null)} style={{ background: '#eee', color: '#666', padding: '10px 20px', fontSize: '1rem', borderBottom: '4px solid #ccc', textTransform: 'none' }}>
                <ChevronLeft size={24} /> TRỞ VỀ
              </button>
              <button
                className="btn-kid"
                onClick={() => setIsMusicEnabled(!isMusicEnabled)}
                style={{
                  background: isMusicEnabled ? 'var(--secondary)' : '#eee',
                  color: isMusicEnabled ? 'white' : '#999',
                  padding: '10px',
                  borderRadius: '50%',
                  width: '60px',
                  height: '60px',
                  boxShadow: 'none',
                  borderBottom: isMusicEnabled ? '4px solid #3ca9a0' : '4px solid #ccc',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                {isMusicEnabled ? (
                  <>
                    <Volume2 size={20} />
                    <div className="music-wave-container">
                      <div className="music-bar" />
                      <div className="music-bar" />
                      <div className="music-bar" />
                    </div>
                  </>
                ) : <VolumeX size={24} />}
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              {childInfo?.avatarUrl ? (
                <motion.img
                  animate={{ y: [0, -8, 0], rotate: [0, 2, -2, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  src={childInfo.avatarUrl} alt="Avatar" style={{ width: '180px', height: '180px', borderRadius: '50%', objectFit: 'cover', border: '8px solid white', boxShadow: '0 15px 35px rgba(0,0,0,0.2)' }}
                />
              ) : (
                <div style={{ width: '180px', height: '180px', borderRadius: '50%', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '8px solid white' }}><User size={90} color="#ccc" /></div>
              )}
              <div style={{ position: 'absolute', bottom: '5px', right: '5px', background: 'var(--success)', color: 'white', padding: '8px', borderRadius: '50%', border: '4px solid white', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                <Star size={20} fill="white" />
              </div>
            </div>
            <h1 className="vibrant-gradient" style={{ fontSize: '2.5rem', margin: 0, fontWeight: 900 }}>Bé {selectedChild}</h1>
            <div className="date-badge" style={{ padding: '8px 20px', fontSize: '1.1rem', background: '#f0f4ff', color: '#5566aa', border: '2px solid white', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}><Calendar size={18} /> {childInfo?.startDate || '?'} - {childInfo?.endDate || '?'}</div>
            <button className="btn-kid" onClick={startEditing} style={{ background: 'var(--secondary)', color: 'white', width: '100%', justifyContent: 'center', fontSize: '1.1rem', borderBottom: '6px solid #3ca9a0' }}>
              <Edit2 size={20} /> CÀI ĐẶT / SỬA TIÊU CHÍ
            </button>
          </motion.div>

          {childInfo?.rewardName && (
            <motion.div
              className={`card magical-card ${!isGoalReached ? 'floating' : ''}`}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{
                border: isGoalReached ? '10px solid #FFD700' : '8px solid var(--accent)',
                background: isGoalReached ? 'linear-gradient(135deg, #fff 0%, #fff4cc 100%)' : 'white',
                padding: '25px',
                marginTop: '0',
                display: 'flex',
                flexDirection: 'column',
                gap: '15px',
                alignItems: 'center',
                textAlign: 'center',
                boxShadow: isGoalReached ? '0 25px 60px rgba(255, 215, 0, 0.5)' : '0 15px 35px rgba(0,0,0,0.1)',
                flex: 1,
                justifyContent: 'center',
                minHeight: 0
              }}
            >
              {childInfo.rewardImage ? (
                <motion.img
                  animate={isGoalReached ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 5, 0] } : {}}
                  transition={{ repeat: Infinity, duration: 2 }}
                  src={childInfo.rewardImage} alt="Quà" className="reward-image" style={{ width: '230px', height: '230px', boxShadow: '0 12px 30px rgba(0,0,0,0.2)', border: '8px solid white', borderRadius: '30px', objectFit: 'cover' }}
                />
              ) : (
                <div className="reward-image" style={{ width: '230px', height: '230px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9f9f9', border: '8px solid white', borderRadius: '30px' }}><Gift size={100} color="#ddd" /></div>
              )}
              <div className="reward-card-content">
                <h3 style={{ color: '#B8860B', fontWeight: 900, fontSize: '1.2rem', textTransform: 'uppercase', marginBottom: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Gift size={22} /> {isGoalReached ? 'QUÁ TUYỆT VỜI!' : 'PHẦN THƯỞNG ĐANG ĐỢI:'}
                </h3>
                <motion.p
                  className="reward-name-text"
                  animate={isGoalReached ? { scale: [1, 1.05, 1] } : { y: [0, -3, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  {childInfo.rewardName}
                </motion.p>
              </div>
              {isGoalReached ? (
                <motion.div
                  animate={{ rotate: [0, 15, -15, 15, 0], scale: [1, 1.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  style={{ textAlign: 'center', color: '#FFD700', filter: 'drop-shadow(0 10px 20px rgba(255, 215, 0, 0.5))' }}
                >
                  <Trophy size={70} />
                  <div style={{ fontWeight: 900, fontSize: '1.5rem', marginTop: '10px' }}>NHẬN QUÀ THÔI!</div>
                </motion.div>
              ) : (
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  style={{ textAlign: 'center' }}
                >
                  <Star size={50} color="var(--accent)" fill="var(--accent)" style={{ marginBottom: '5px' }} />
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#aaa' }}>CÒN CHÚT XỈU NỮA THÔI!</div>
                </motion.div>
              )}
            </motion.div>
          )}
        </div>

        {/* CỘT PHẢI: BẢNG TIẾN ĐỘ & NHIỆM VỤ */}
        <div className="right-panel">
          <motion.div
            className="card magical-card"
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: "spring", damping: 15 }}
            style={{ width: '100%', marginBottom: '0', padding: '25px', flexShrink: 0, border: '6px solid white' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <span style={{ fontWeight: 900, fontSize: '1.8rem', color: isGoalReached ? 'var(--success)' : 'var(--text)', textShadow: '2px 2px 0 white' }}>
                KẾT QUẢ: {Math.round(percentage)}% {isGoalReached && ' 🎉🏆'}
              </span>
              <div className="target-badge" style={{ background: isGoalReached ? 'var(--success)' : 'var(--primary)', color: 'white', fontSize: '1.2rem', padding: '10px 25px', borderRadius: '50px', fontWeight: 900, borderBottom: '6px solid rgba(0,0,0,0.1)' }}>
                MỤC TIÊU: 80%
              </div>
            </div>
            <div className="progress-container" style={{ height: '35px', borderRadius: '20px', border: '5px solid white', background: 'rgba(0,0,0,0.05)', boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.1)', position: 'relative' }}>
              <motion.div className="progress-bar" initial={{ width: 0 }} animate={{ width: `${percentage}%` }} style={{ backgroundColor: isGoalReached ? '#4CAF50' : 'var(--primary)', position: 'relative', overflow: 'hidden', height: '100%', borderRadius: '15px' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(45deg, rgba(255,255,255,0.4) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.4) 75%, transparent 75%, transparent)', backgroundSize: '40px 40px', animation: 'move 2s linear infinite' }}></div>
              </motion.div>
            </div>
          </motion.div>

          <motion.div
            className="card magical-card"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", damping: 15, delay: 0.2 }}
            style={{ width: '100%', padding: '25px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, border: '6px solid white' }}
          >
            <div className="weekly-grid">
              <div className="grid-header" style={{ fontSize: '1.2rem' }}>TIÊU CHÍ</div>
              {DAYS.map(day => <div key={day} className="grid-header" style={{ fontSize: '1.4rem' }}>{day}</div>)}
              {tasks.map((task, idx) => (
                <motion.div
                  key={task.id}
                  className="criterion-row"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.5 + idx * 0.1 }}
                >
                  <div className="criterion-info" style={{ background: 'white', borderRadius: '25px', border: '4px solid #f0f0f0', padding: '10px' }}>
                    {task.imageUrl ? (
                      <img src={task.imageUrl} alt={task.title} className="criterion-image" style={{ width: '60px', height: '60px', borderRadius: '15px' }} />
                    ) : (
                      <div className="criterion-image" style={{ width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', borderRadius: '15px' }}><ImageIcon size={30} color="#ccc" /></div>
                    )}
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', flex: 1, lineHeight: '1.2', color: '#555' }}>{task.title}</span>
                  </div>
                  {task.progress.map((done, dayIdx) => (
                    <motion.div
                      key={dayIdx}
                      className={`day-cell ${done ? 'completed' : ''}`}
                      onClick={() => toggleTask(task.id, dayIdx)}
                      whileTap={{ scale: 0.8 }}
                      whileHover={{ scale: 1.1 }}
                      style={{
                        borderRadius: '20px',
                        border: '4px solid white',
                        boxShadow: '0 5px 10px rgba(0,0,0,0.05)',
                        background: done ? 'var(--success)' : 'white'
                      }}
                    >
                      <AnimatePresence>
                        {done && (
                          <motion.div
                            initial={{ scale: 0, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0, rotate: 45 }}
                            transition={{ type: "spring", damping: 10 }}
                          >
                            <Check size={40} color="white" strokeWidth={6} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </motion.div>
              ))}
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '20px', display: 'flex', justifyContent: 'center', gap: '30px', alignItems: 'center', flexShrink: 0 }}>
              <button
                className="btn-kid"
                style={{ background: 'var(--primary)', color: 'white', padding: '15px 40px', fontSize: '1.4rem', borderBottom: '8px solid #cc5656' }}
                onClick={resetWeek}
              >
                <RefreshCcw size={28} /> TUẦN MỚI NÀO!
              </button>
              <div
                className="btn-kid"
                style={{ background: '#FFF7CC', color: '#B8860B', cursor: 'default', padding: '15px 40px', fontSize: '1.5rem', fontWeight: 900, borderBottom: '8px solid #e6ce4d', border: '4px solid white' }}
              >
                <Star size={28} fill="#B8860B" /> {currentDone} / {totalPossible} TÍCH ĐIỂM
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div >
  );
};

export default App;
