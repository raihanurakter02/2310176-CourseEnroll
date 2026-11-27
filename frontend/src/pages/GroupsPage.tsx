import React, { useContext, useEffect, useState } from 'react';
import api from '../api';
import { AuthContext } from '../AuthContext';
import { ToastContext } from '../ToastContext';

interface GroupMember {
  id: number;
  user_id: number;
  user_name: string | null;
  user_email: string | null;
  can_create: boolean;
  can_edit: boolean;
  can_assign: boolean;
}

interface GroupItem {
  id: number;
  title: string;
  description: string | null;
  status: string;
  created_by: number;
  creator_name: string | null;
  assigned_to: number | null;
  assignee_name: string | null;
}

interface StudyGroup {
  id: number;
  name: string;
  description: string | null;
  course_id: number | null;
  course_code: string | null;
  owner_id: number;
  owner_name: string | null;
  owner_email: string | null;
  member_count: number;
  item_count: number;
  my_permissions?: {
    is_owner: boolean;
    is_member: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_assign: boolean;
    can_manage_members: boolean;
  };
  members: GroupMember[];
  items: GroupItem[];
}

const GroupsPage: React.FC = () => {
  const auth = useContext(AuthContext);
  const toast = useContext(ToastContext);

  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null);
  const [loading, setLoading] = useState(true);

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  const [renameValue, setRenameValue] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPerms, setMemberPerms] = useState({ can_create: true, can_edit: false, can_assign: false });

  const [itemTitle, setItemTitle] = useState('');
  const [itemDesc, setItemDesc] = useState('');

  const fetchGroups = async (selectId?: number) => {
    setLoading(true);
    try {
      const res = await api.get('/groups', { skipCache: true } as any);
      setGroups(res.data || []);
      const targetId = selectId ?? selectedGroup?.id;
      if (targetId) {
        const found = (res.data || []).find((g: StudyGroup) => g.id === targetId);
        if (found) {
          await loadGroupDetail(targetId);
        } else {
          setSelectedGroup(null);
        }
      }
    } catch {
      toast?.showToast('Failed to load study groups', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadGroupDetail = async (id: number) => {
    try {
      const res = await api.get(`/groups/${id}`, { skipCache: true } as any);
      setSelectedGroup(res.data);
      setRenameValue(res.data.name);
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Access denied', 'error');
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      const res = await api.post('/groups', { name: newGroupName, description: newGroupDesc });
      toast?.showToast('Study group created', 'success');
      setNewGroupName('');
      setNewGroupDesc('');
      await fetchGroups(res.data.id);
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to create group', 'error');
    }
  };

  const handleRenameGroup = async () => {
    if (!selectedGroup || !renameValue.trim()) return;
    try {
      await api.put(`/groups/${selectedGroup.id}`, { name: renameValue, description: selectedGroup.description });
      toast?.showToast('Group renamed', 'success');
      await fetchGroups(selectedGroup.id);
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Only owner can rename group', 'error');
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    try {
      await api.delete(`/groups/${selectedGroup.id}`);
      toast?.showToast('Group deleted', 'success');
      setSelectedGroup(null);
      await fetchGroups();
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Only owner can delete group', 'error');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !memberEmail.trim()) return;
    try {
      await api.post(`/groups/${selectedGroup.id}/members`, {
        email: memberEmail.trim(),
        ...memberPerms,
      });
      toast?.showToast('Member added', 'success');
      setMemberEmail('');
      await loadGroupDetail(selectedGroup.id);
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to add member', 'error');
    }
  };

  const handleToggleMemberPerm = async (m: GroupMember, field: 'can_create' | 'can_edit' | 'can_assign') => {
    if (!selectedGroup) return;
    try {
      await api.put(`/groups/${selectedGroup.id}/members/${m.user_id}`, {
        can_create: field === 'can_create' ? !m.can_create : m.can_create,
        can_edit: field === 'can_edit' ? !m.can_edit : m.can_edit,
        can_assign: field === 'can_assign' ? !m.can_assign : m.can_assign,
      });
      toast?.showToast('Permissions updated', 'success');
      await loadGroupDetail(selectedGroup.id);
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to update permissions', 'error');
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!selectedGroup) return;
    try {
      await api.delete(`/groups/${selectedGroup.id}/members/${userId}`);
      toast?.showToast('Member removed', 'success');
      await loadGroupDetail(selectedGroup.id);
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Failed to remove member', 'error');
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !itemTitle.trim()) return;
    try {
      await api.post(`/groups/${selectedGroup.id}/items`, { title: itemTitle, description: itemDesc });
      toast?.showToast('Shared item created', 'success');
      setItemTitle('');
      setItemDesc('');
      await loadGroupDetail(selectedGroup.id);
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Missing create permission', 'error');
    }
  };

  const handleUpdateItemStatus = async (item: GroupItem, status: string) => {
    if (!selectedGroup) return;
    try {
      await api.put(`/groups/${selectedGroup.id}/items/${item.id}`, { status });
      toast?.showToast('Item updated', 'success');
      await loadGroupDetail(selectedGroup.id);
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Missing edit permission', 'error');
    }
  };

  const handleAssignItem = async (item: GroupItem, assignedTo: number | null) => {
    if (!selectedGroup) return;
    try {
      await api.put(`/groups/${selectedGroup.id}/items/${item.id}`, { assigned_to: assignedTo });
      toast?.showToast('Assignment updated', 'success');
      await loadGroupDetail(selectedGroup.id);
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Missing assign permission', 'error');
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!selectedGroup) return;
    try {
      await api.delete(`/groups/${selectedGroup.id}/items/${itemId}`);
      toast?.showToast('Item deleted', 'success');
      await loadGroupDetail(selectedGroup.id);
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Cannot delete item', 'error');
    }
  };

  const perms = selectedGroup?.my_permissions;

  return (
    <div>
      <div className="page-header">
        <h1>Study Groups & Shared Teams</h1>
        <p>Collaborate in shared groups with fine-grained permissions (create, edit, assign). Only owners can rename, delete, or manage members.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 2fr', gap: '1.5rem', alignItems: 'start' }}>
        <div>
          <div className="course-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Create Study Group</h3>
            <form onSubmit={handleCreateGroup}>
              <input
                type="text"
                placeholder="Group name (e.g. CSE303 Project Team)"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                required
                style={{ width: '100%', padding: '0.55rem', marginBottom: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', marginBottom: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
              />
              <button type="submit" className="btn-primary" style={{ width: '100%' }}>+ Create Group</button>
            </form>
          </div>

          <div className="course-card" style={{ padding: '1.25rem' }}>
            <h3 style={{ marginTop: 0 }}>Your Groups ({groups.length})</h3>
            {loading ? (
              <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
            ) : groups.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No groups yet. Create one above or ask an owner to invite you.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => loadGroupDetail(g.id)}
                    style={{
                      textAlign: 'left',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius)',
                      border: selectedGroup?.id === g.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: selectedGroup?.id === g.id ? '#eef2ff' : 'var(--surface)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{g.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Owner: {g.owner_name} · {g.member_count} members · {g.item_count} items
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          {!selectedGroup ? (
            <div className="course-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Select a group on the left to view shared items, members, and permissions.
            </div>
          ) : (
            <div className="course-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ margin: '0 0 0.25rem 0' }}>{selectedGroup.name}</h2>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Owner: <strong>{selectedGroup.owner_name}</strong> ({selectedGroup.owner_email})
                  </p>
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    {perms?.is_owner && <span className="badge badge-success">Owner</span>}
                    {perms?.can_create && <span className="badge badge-info">Create</span>}
                    {perms?.can_edit && <span className="badge badge-warning">Edit</span>}
                    {perms?.can_assign && <span className="badge badge-info">Assign</span>}
                    {!perms?.is_owner && !perms?.can_create && !perms?.can_edit && !perms?.can_assign && (
                      <span className="badge">Read-only Member</span>
                    )}
                  </div>
                </div>

                {perms?.is_owner && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      style={{ padding: '0.4rem 0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
                    />
                    <button className="btn-secondary" onClick={handleRenameGroup}>Rename</button>
                    <button className="btn-danger" onClick={handleDeleteGroup}>Delete Group</button>
                  </div>
                )}
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1.25rem 0' }} />

              <h3>Shared Tasks / Resources</h3>
              {perms?.can_create && (
                <form onSubmit={handleCreateItem} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="New task or shared note title"
                    value={itemTitle}
                    onChange={(e) => setItemTitle(e.target.value)}
                    required
                    style={{ flex: 2, minWidth: '180px', padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
                  />
                  <input
                    type="text"
                    placeholder="Details (optional)"
                    value={itemDesc}
                    onChange={(e) => setItemDesc(e.target.value)}
                    style={{ flex: 2, minWidth: '160px', padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
                  />
                  <button type="submit" className="btn-primary">+ Add Item</button>
                </form>
              )}

              {selectedGroup.items.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No shared items in this group yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.5rem' }}>
                  {selectedGroup.items.map((item) => (
                    <div key={item.id} style={{ padding: '0.85rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{item.title}</div>
                        {item.description && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.description}</div>}
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          Created by {item.creator_name} · Assigned to: <strong>{item.assignee_name || 'Unassigned'}</strong>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select
                          value={item.status}
                          disabled={!perms?.can_edit}
                          onChange={(e) => handleUpdateItemStatus(item, e.target.value)}
                          style={{ padding: '0.35rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
                        >
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="done">Done</option>
                        </select>
                        <select
                          value={item.assigned_to ?? ''}
                          disabled={!perms?.can_assign}
                          onChange={(e) => handleAssignItem(item, e.target.value ? Number(e.target.value) : null)}
                          style={{ padding: '0.35rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
                        >
                          <option value="">Unassigned</option>
                          <option value={selectedGroup.owner_id}>{selectedGroup.owner_name} (Owner)</option>
                          {selectedGroup.members.map((m) => (
                            <option key={m.user_id} value={m.user_id}>{m.user_name || m.user_email}</option>
                          ))}
                        </select>
                        {(perms?.is_owner || item.created_by === auth?.user?.id) && (
                          <button className="btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handleDeleteItem(item.id)}>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1.25rem 0' }} />

              <h3>Group Members</h3>
              {perms?.is_owner && (
                <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <input
                    type="email"
                    placeholder="Member email (e.g. mila@gmail.com)"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    required
                    style={{ flex: 1, minWidth: '200px', padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
                  />
                  <label style={{ fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={memberPerms.can_create} onChange={(e) => setMemberPerms({ ...memberPerms, can_create: e.target.checked })} /> Create
                  </label>
                  <label style={{ fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={memberPerms.can_edit} onChange={(e) => setMemberPerms({ ...memberPerms, can_edit: e.target.checked })} /> Edit
                  </label>
                  <label style={{ fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={memberPerms.can_assign} onChange={(e) => setMemberPerms({ ...memberPerms, can_assign: e.target.checked })} /> Assign
                  </label>
                  <button type="submit" className="btn-primary">Add Member</button>
                </form>
              )}

              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Create</th>
                    <th>Edit</th>
                    <th>Assign</th>
                    {perms?.is_owner && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {selectedGroup.members.length === 0 ? (
                    <tr><td colSpan={perms?.is_owner ? 5 : 4} style={{ color: 'var(--text-muted)' }}>No additional members yet.</td></tr>
                  ) : (
                    selectedGroup.members.map((m) => (
                      <tr key={m.user_id}>
                        <td>{m.user_name} ({m.user_email})</td>
                        <td>
                          <input type="checkbox" checked={m.can_create} disabled={!perms?.is_owner} onChange={() => handleToggleMemberPerm(m, 'can_create')} />
                        </td>
                        <td>
                          <input type="checkbox" checked={m.can_edit} disabled={!perms?.is_owner} onChange={() => handleToggleMemberPerm(m, 'can_edit')} />
                        </td>
                        <td>
                          <input type="checkbox" checked={m.can_assign} disabled={!perms?.is_owner} onChange={() => handleToggleMemberPerm(m, 'can_assign')} />
                        </td>
                        {perms?.is_owner && (
                          <td>
                            <button className="btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem' }} onClick={() => handleRemoveMember(m.user_id)}>Remove</button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupsPage;
