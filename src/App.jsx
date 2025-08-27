import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { jwtDecode } from 'jwt-decode';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const API = 'https://todo-be-ax5x.onrender.com'

function useAuth() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  // Initialize from memory storage on component mount
  useEffect(() => {
    // In a real app, you'd get this from localStorage
    // For this demo, we start with null
    const savedToken = null; // localStorage.getItem('token')
    if (savedToken) {
      try {
        const decoded = jwtDecode(savedToken);
        setToken(savedToken);
        setUser({ id: decoded.sub, email: decoded.email });
      } catch {
        // Invalid token, ignore
      }
    }
  }, []);

  const headers = useMemo(() => token ? { Authorization: `Bearer ${token}` } : {}, [token]);
  return { token, setToken, user, setUser, headers };
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const url = mode === 'login' ? '/auth/login' : '/auth/signup';
      const response = await fetch(API + url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }
      
      onAuth(data.token, data.user);
    } catch (error) {
      alert(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      <div className="card">
        <h2 style={{marginTop:0}}>{mode === 'login' ? 'Login' : 'Sign Up'}</h2>
        <form onSubmit={submit}>
          <div style={{display:'grid', gap:8}}>
            <input 
              placeholder="Email" 
              type="email"
              value={email} 
              onChange={e=>setEmail(e.target.value)} 
              required 
              disabled={loading}
            />
            <input 
              placeholder="Password" 
              type="password" 
              value={password} 
              onChange={e=>setPassword(e.target.value)} 
              required 
              disabled={loading}
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Loading...' : (mode === 'login' ? 'Login' : 'Create account')}
            </button>
          </div>
        </form>
        <div style={{marginTop:8}}>
          {mode==='login' ? (
            <button onClick={()=>setMode('signup')} disabled={loading}>
              Need an account? Sign up
            </button>
          ) : (
            <button onClick={()=>setMode('login')} disabled={loading}>
              Have an account? Log in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task, onOpen }) {
  return (
    <div className="task" onClick={()=>onOpen(task)}>
      <div style={{fontWeight:600}}>{task.title}</div>
      <div className="meta">
        <span>Priority: {task.priority}</span>
        <span>Assignee: {task.assignee?.email || '—'}</span>
        <span>Due: {dayjs(task.dueDate).format('MMM D, HH:mm')}</span>
        <span className="badge">{task.badge}</span>
      </div>
    </div>
  )
}

function Column({ droppableId, title, tasks, onOpen }) {
  return (
    <div className="col">
      <h3>{title}</h3>
      <Droppable droppableId={droppableId}>
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            {tasks.map((t, idx) => (
              <Draggable draggableId={t.id} index={idx} key={t.id}>
                {(pp)=>(
                  <div ref={pp.innerRef} {...pp.draggableProps} {...pp.dragHandleProps}>
                    <TaskCard task={t} onOpen={onOpen} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
}

export default function App() {
  const { token, setToken, user, setUser, headers } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ assigneeId: '', priority: '' });
  const [modal, setModal] = useState(null);
  const [newTask, setNewTask] = useState({ 
    title:'', 
    description:'', 
    priority:'MEDIUM', 
    assigneeId:'', 
    dueDate:'' 
  });
  const [loading, setLoading] = useState(false);
  
  const statuses = ['BACKLOG','IN_PROGRESS','REVIEW','DONE'];
  const statusTitles = { 
    BACKLOG:'Backlog', 
    IN_PROGRESS:'In Progress', 
    REVIEW:'Review', 
    DONE:'Done' 
  };

  async function fetchTasks() {
    try {
      const params = new URLSearchParams();
      if (filters.assigneeId && filters.assigneeId.trim() !== '') {
        params.append('assigneeId', filters.assigneeId.trim());
      }
      if (filters.priority && filters.priority.trim() !== '') {
        params.append('priority', filters.priority.trim());
      }
      
      console.log('Fetching tasks with params:', params.toString());
      
      const response = await fetch(`${API}/tasks?${params.toString()}`, { 
        headers 
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }
      
      const data = await response.json();
      console.log('Fetched tasks:', data);
      setTasks(data);
      
      // Extract unique users from tasks
      const emails = {};
      data.forEach(t => { 
        if (t.assignee) emails[t.assignee.id] = t.assignee.email; 
      });
      const usersFromTasks = Object.entries(emails).map(([id,email])=>({id,email}));
      
      // Merge with existing users
      setUsers(prevUsers => {
        const userMap = new Map();
        prevUsers.forEach(u => userMap.set(u.id, u));
        usersFromTasks.forEach(u => userMap.set(u.id, u));
        return Array.from(userMap.values());
      });
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      alert('Failed to load tasks. Please check your connection.');
    }
  }

  async function fetchUsers() {
    try {
      const response = await fetch(`${API}/tasks/users`, { headers });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await response.json();
      console.log('Fetched users:', data);
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      // Fallback to extracting users from tasks if the endpoint fails
    }
  }

  useEffect(() => { 
    if (token) {
      fetchTasks();
      fetchUsers();
    }
  }, [token, filters]);

  function groupByStatus(list) {
    return statuses.reduce((acc,s)=>({ ...acc, [s]: list.filter(t=>t.status===s) }), {});
  }
  const groups = groupByStatus(tasks);

  async function onDragEnd(result) {
    if (!result.destination) return;
    
    const taskId = result.draggableId;
    const destCol = result.destination.droppableId;
    const current = tasks.find(t=>t.id===taskId);
    
    if (!current || current.status === destCol) return;
    
    try {
      const response = await fetch(`${API}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: destCol })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update task status');
      }
      
      const updatedTask = await response.json();
      setTasks(prev => prev.map(t => t.id===taskId ? updatedTask : t));
    } catch (error) {
      console.error('Failed to update task status:', error);
      alert('Failed to update task status');
    }
  }

  async function createTask(e) {
    e.preventDefault();
    
    console.log('Original newTask data:', newTask);
    
    // Validate required fields before processing
    if (!newTask.title.trim()) {
      alert('Title is required');
      return;
    }
    if (!newTask.description.trim()) {
      alert('Description is required');
      return;
    }
    if (!newTask.dueDate) {
      alert('Due date and time are required');
      return;
    }
    
    setLoading(true);
    
    try {
      let data = { ...newTask };

      // Ensure dueDate is valid
      console.log('Raw dueDate from form:', data.dueDate);
      
      // The datetime-local input gives us a string like "2024-08-24T15:30"
      if (!data.dueDate || data.dueDate.length < 16) {
        alert('Please select a complete date and time');
        setLoading(false);
        return;
      }
      
      // Test if the date is valid before sending
      const testDate = new Date(data.dueDate);
      if (isNaN(testDate.getTime())) {
        alert('Invalid date format');
        setLoading(false);
        return;
      }
      
      // Convert to ISO string for the API
      data.dueDate = testDate.toISOString();
      console.log('Converted dueDate to ISO:', data.dueDate);

      // Handle assigneeId
      if (!data.assigneeId || data.assigneeId.trim() === '' || data.assigneeId === 'null') {
        data.assigneeId = null;
      } else {
        data.assigneeId = data.assigneeId.trim();
      }

      // Ensure all required fields are strings and trimmed
      data.title = data.title.trim();
      data.description = data.description.trim();

      console.log('Final data being sent to API:', data);

      const response = await fetch(`${API}/tasks`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || 'Failed to create task');
      }

      const createdTask = await response.json();
      console.log('Task created successfully:', createdTask);
      
      setNewTask({ title:'', description:'', priority:'MEDIUM', assigneeId:'', dueDate:'' });
      setTasks(prev => [createdTask, ...prev]);
      alert('Task created successfully!');
      
    } catch (err) {
      console.error('Failed to create task:', err.message);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function addComment(id, body) {
    try {
      const response = await fetch(`${API}/tasks/${id}/comments`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ body })
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      const comment = await response.json();
      setModal(m => ({ ...m, comments: [...(m.comments||[]), comment] }));
    } catch (error) {
      console.error('Failed to add comment:', error);
      alert('Failed to add comment');
    }
  }

  async function openTask(task) {
    try {
      const [taskResponse, commentsResponse] = await Promise.all([
        fetch(`${API}/tasks/${task.id}`, { headers }),
        fetch(`${API}/tasks/${task.id}/comments`, { headers })
      ]);

      if (!taskResponse.ok || !commentsResponse.ok) {
        throw new Error('Failed to load task details');
      }

      const taskData = await taskResponse.json();
      const commentsData = await commentsResponse.json();
      
      setModal({ ...taskData, comments: commentsData });
    } catch (error) {
      console.error('Failed to open task:', error);
      alert('Failed to load task details');
    }
  }

  function logout() {
    setToken(null); 
    setUser(null);
    setTasks([]);
    setUsers([]);
    setModal(null);
  }

  if (!token) return <AuthScreen onAuth={(t,u)=>{ setToken(t); setUser(u); }} />;

  return (
    <div className="container">
      <div className="toolbar">
        <strong>Team Task Board</strong>
        <span style={{flex:1}} />
        <select 
          value={filters.assigneeId} 
          onChange={e=>setFilters(f=>({...f, assigneeId:e.target.value}))}
        >
          <option value="">All Assignees</option>
          {users.map(u=><option key={u.id} value={u.id}>{u.email}</option>)}
        </select>
        <select 
          value={filters.priority} 
          onChange={e=>setFilters(f=>({...f, priority:e.target.value}))}
        >
          <option value="">All Priorities</option>
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
        </select>
        <button onClick={logout}>Logout</button>
      </div>

      <form className="toolbar" onSubmit={createTask}>
        <input 
          placeholder="Title" 
          value={newTask.title} 
          onChange={e=>setNewTask(s=>({...s,title:e.target.value}))} 
          required 
          disabled={loading}
        />
        <input 
          placeholder="Description" 
          value={newTask.description} 
          onChange={e=>setNewTask(s=>({...s,description:e.target.value}))} 
          required 
          disabled={loading}
        />
        <select 
          value={newTask.priority} 
          onChange={e=>setNewTask(s=>({...s,priority:e.target.value}))}
          disabled={loading}
        >
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
        </select>
        <select
          value={newTask.assigneeId}
          onChange={e => setNewTask(s => ({ ...s, assigneeId: e.target.value }))}
          disabled={loading}
        >
          <option value="">No Assignee</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
        </select>
        <input 
          type="datetime-local" 
          value={newTask.dueDate} 
          onChange={e=>setNewTask(s=>({...s,dueDate:e.target.value}))} 
          required 
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Adding...' : 'Add Task'}
        </button>
      </form>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="board">
          {Object.entries(groups).map(([status, items]) => (
            <Column
              key={status}
              droppableId={status}
              title={statusTitles[status]}
              tasks={items}
              onOpen={openTask}
            />
          ))}
        </div>
      </DragDropContext>

      {modal && (
        <div className="modal" onClick={()=>setModal(null)}>
          <div className="modal-card" onClick={e=>e.stopPropagation()}>
            <h3 style={{marginTop:0}}>{modal.title}</h3>
            <div style={{color:'#555'}}>{modal.description}</div>
            <div className="meta" style={{marginTop:8}}>
              <span>Priority: {modal.priority}</span>
              <span>Assignee: {modal.assignee?.email || '—'}</span>
              <span>Due: {dayjs(modal.dueDate).format('MMM D, HH:mm')}</span>
              <span className="badge">{modal.badge}</span>
            </div>
            <div className="comments">
              <strong>Comments</strong>
              <div>
                {(modal.comments||[]).map(c=>(
                  <div key={c.id} style={{padding:'6px 0', borderBottom:'1px dashed #eee'}}>
                    <div style={{fontSize:12, color:'#666'}}>
                      {c.author?.email} • {dayjs(c.createdAt).format('MMM D, HH:mm')}
                    </div>
                    <div>{c.body}</div>
                  </div>
                ))}
              </div>
              <CommentForm onAdd={(body)=>addComment(modal.id, body)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentForm({ onAdd }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  
  return (
    <form 
      onSubmit={async (e)=>{ 
        e.preventDefault(); 
        if(text.trim() && !loading){ 
          setLoading(true);
          try {
            await onAdd(text.trim()); 
            setText(''); 
          } catch (error) {
            console.error('Failed to add comment:', error);
          } finally {
            setLoading(false);
          }
        }
      }} 
      style={{display:'flex', gap:8, marginTop:8}}
    >
      <input 
        placeholder="Add a short comment…" 
        value={text} 
        onChange={e=>setText(e.target.value)} 
        disabled={loading}
      />
      <button type="submit" disabled={loading || !text.trim()}>
        {loading ? 'Adding...' : 'Add'}
      </button>
    </form>
  )
}
