import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import useUserRole from '../hooks/useUserRole';

const ApplicationManagement = () => {
  const { hasPermission, updateUserRole } = useUserRole();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  // Load all applications
  const loadApplications = async () => {
    try {
      setLoading(true);
      const applicationsCollection = collection(db, 'staff_applications');
      const applicationsSnapshot = await getDocs(applicationsCollection);
      const applicationsList = applicationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by creation date, newest first
      applicationsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setApplications(applicationsList);
    } catch (err) {
      console.error('Error loading applications:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasPermission('canManageRoles') || hasPermission('canEditUsers')) {
      loadApplications();
    }
  }, [hasPermission]);

  // Check if user has permission to manage applications
  if (!hasPermission('canManageRoles') && !hasPermission('canEditUsers')) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: '#ef4444'
      }}>
        <h3>Access Denied</h3>
        <p>Anda tidak memiliki permission untuk mengakses halaman ini.</p>
      </div>
    );
  }

  // Handle application approval
  const handleApprove = async (applicationId, userId) => {
    try {
      setProcessingId(applicationId);
      
      // Update user role to Auditor (default role for new staff)
      const success = await updateUserRole(userId, 'Auditor');
      
      if (success) {
        // Update application status
        const applicationDocRef = doc(db, 'staff_applications', applicationId);
        await updateDoc(applicationDocRef, {
          status: 'approved',
          updatedAt: new Date().toISOString(),
          processedAt: new Date().toISOString()
        });
        
        // Update local state
        setApplications(prev => prev.map(app => 
          app.id === applicationId 
            ? { ...app, status: 'approved', processedAt: new Date().toISOString() }
            : app
        ));
      }
    } catch (err) {
      console.error('Error approving application:', err);
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Handle application rejection
  const handleReject = async (applicationId) => {
    try {
      setProcessingId(applicationId);
      
      const applicationDocRef = doc(db, 'staff_applications', applicationId);
      await updateDoc(applicationDocRef, {
        status: 'rejected',
        updatedAt: new Date().toISOString(),
        processedAt: new Date().toISOString()
      });
      
      // Update local state
      setApplications(prev => prev.map(app => 
        app.id === applicationId 
          ? { ...app, status: 'rejected', processedAt: new Date().toISOString() }
          : app
      ));
    } catch (err) {
      console.error('Error rejecting application:', err);
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Handle application deletion
  const handleDelete = async (applicationId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus aplikasi ini?')) {
      return;
    }

    try {
      setProcessingId(applicationId);
      
      await deleteDoc(doc(db, 'staff_applications', applicationId));
      
      // Update local state
      setApplications(prev => prev.filter(app => app.id !== applicationId));
    } catch (err) {
      console.error('Error deleting application:', err);
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Get status badge color
  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'approved': return '#10b981';
      case 'rejected': return '#ef4444';
      default: return '#6b7280';
    }
  };

  // Get status label
  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Menunggu';
      case 'approved': return 'Disetujui';
      case 'rejected': return 'Ditolak';
      default: return status;
    }
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading applications...</p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
      padding: '24px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: '700',
          color: '#1f2937',
          margin: 0
        }}>
          📋 Manajemen Aplikasi Staff
        </h2>
        <button
          onClick={loadApplications}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '16px',
          color: '#dc2626'
        }}>
          Error: {error}
        </div>
      )}

      <div style={{
        overflowX: 'auto'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse'
        }}>
          <thead>
            <tr style={{
              backgroundColor: '#f9fafb',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <th style={{
                padding: '12px',
                textAlign: 'left',
                fontWeight: '600',
                color: '#374151'
              }}>Pemohon</th>
              <th style={{
                padding: '12px',
                textAlign: 'left',
                fontWeight: '600',
                color: '#374151'
              }}>Nama</th>
              <th style={{
                padding: '12px',
                textAlign: 'left',
                fontWeight: '600',
                color: '#374151'
              }}>Jabatan</th>
              <th style={{
                padding: '12px',
                textAlign: 'left',
                fontWeight: '600',
                color: '#374151'
              }}>Section</th>
              <th style={{
                padding: '12px',
                textAlign: 'left',
                fontWeight: '600',
                color: '#374151'
              }}>Status</th>
              <th style={{
                padding: '12px',
                textAlign: 'left',
                fontWeight: '600',
                color: '#374151'
              }}>Tanggal</th>
              <th style={{
                padding: '12px',
                textAlign: 'left',
                fontWeight: '600',
                color: '#374151'
              }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {applications.map(application => (
              <tr key={application.id} style={{
                borderBottom: '1px solid #e5e7eb'
              }}>
                <td style={{ padding: '12px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    {application.userPhotoURL && (
                      <img
                        src={application.userPhotoURL}
                        alt={application.userDisplayName}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          objectFit: 'cover'
                        }}
                      />
                    )}
                    <div>
                      <div style={{
                        fontWeight: '500',
                        color: '#1f2937'
                      }}>
                        {application.userDisplayName || 'No Name'}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#6b7280'
                      }}>
                        {application.userEmail}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px', color: '#1f2937', fontWeight: '500' }}>
                  {application.nama}
                </td>
                <td style={{ padding: '12px', color: '#6b7280' }}>
                  {application.jabatan}
                </td>
                <td style={{ padding: '12px', color: '#6b7280' }}>
                  {application.section}
                </td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    backgroundColor: getStatusBadgeColor(application.status),
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {getStatusLabel(application.status)}
                  </span>
                </td>
                <td style={{ padding: '12px', color: '#6b7280', fontSize: '12px' }}>
                  <div>{formatDate(application.createdAt)}</div>
                  {application.processedAt && (
                    <div style={{ marginTop: '4px', fontStyle: 'italic' }}>
                      Diproses: {formatDate(application.processedAt)}
                    </div>
                  )}
                </td>
                <td style={{ padding: '12px' }}>
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap'
                  }}>
                    {application.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(application.id, application.userId)}
                          disabled={processingId === application.id}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: processingId === application.id ? '#9ca3af' : '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: processingId === application.id ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}
                        >
                          {processingId === application.id ? 'Processing...' : 'Setujui'}
                        </button>
                        <button
                          onClick={() => handleReject(application.id)}
                          disabled={processingId === application.id}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: processingId === application.id ? '#9ca3af' : '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: processingId === application.id ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}
                        >
                          {processingId === application.id ? 'Processing...' : 'Tolak'}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(application.id)}
                      disabled={processingId === application.id}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: processingId === application.id ? '#9ca3af' : '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: processingId === application.id ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}
                    >
                      {processingId === application.id ? 'Processing...' : 'Hapus'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {applications.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#6b7280'
        }}>
          <p>Tidak ada aplikasi staff yang ditemukan.</p>
        </div>
      )}
    </div>
  );
};

export default ApplicationManagement;