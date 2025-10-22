'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

interface Material {
  id: string;
  title: string;
  description: string | null;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  uploadedById: string;
  uploaderName: string;
  createdAt: string;
  downloadCount: number;
  categoryId: string | null;
  categoryName: string | null;
}

interface MaterialCategory {
  id: string;
  name: string;
  description: string | null;
  order: number;
}

interface MaterialsTabProps {
  classroomId: string;
  sessionId?: string;
  userRole: string;
}

export default function MaterialsTab({ classroomId, sessionId, userRole }: MaterialsTabProps) {
  const { data: session } = useSession();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [youtubeDesc, setYoutubeDesc] = useState('');

  const isTeacher = userRole === 'teacher' || userRole === 'administrator';

  useEffect(() => {
    fetchMaterials();
    fetchCategories();
  }, [classroomId]);

  const fetchMaterials = async () => {
    try {
      const response = await fetch(`/api/classrooms/${classroomId}/materials`);
      if (response.ok) {
        const data = await response.json();
        setMaterials(data);
      }
    } catch (error) {
      console.error('Failed to fetch materials:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`/api/classrooms/${classroomId}/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be less than 50MB');
      return;
    }

    setUploadingFile(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('classroomId', classroomId);
      if (sessionId) formData.append('sessionId', sessionId);
      if (selectedCategory) formData.append('categoryId', selectedCategory);
      formData.append('publishToChat', 'false'); // Upload to library only

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        toast.success('File uploaded successfully!');
        fetchMaterials();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to upload file');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Category name is required');
      return;
    }

    try {
      const response = await fetch(`/api/classrooms/${classroomId}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName,
          description: newCategoryDesc || null,
        }),
      });

      if (response.ok) {
        toast.success('Category created!');
        setShowCategoryModal(false);
        setNewCategoryName('');
        setNewCategoryDesc('');
        fetchCategories();
      } else {
        toast.error('Failed to create category');
      }
    } catch (error) {
      console.error('Create category error:', error);
      toast.error('Failed to create category');
    }
  };

  const handleAddYoutube = async () => {
    if (!youtubeUrl.trim() || !youtubeTitle.trim()) {
      toast.error('YouTube URL and title are required');
      return;
    }

    // Validate YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;
    if (!youtubeRegex.test(youtubeUrl)) {
      toast.error('Please enter a valid YouTube URL');
      return;
    }

    try {
      const response = await fetch(`/api/classrooms/${classroomId}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: youtubeTitle,
          description: youtubeDesc || null,
          fileUrl: youtubeUrl,
          fileType: 'youtube',
          fileName: youtubeTitle,
          fileSize: 0,
          categoryId: selectedCategory,
          sessionId: sessionId || null,
        }),
      });

      if (response.ok) {
        toast.success('YouTube video added!');
        setShowYoutubeModal(false);
        setYoutubeUrl('');
        setYoutubeTitle('');
        setYoutubeDesc('');
        fetchMaterials();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to add YouTube video');
      }
    } catch (error) {
      console.error('Add YouTube error:', error);
      toast.error('Failed to add YouTube video');
    }
  };

  const handleDownload = async (material: Material) => {
    try {
      // Track download
      await fetch(`/api/materials/${material.id}/download`, {
        method: 'POST',
      });

      // Trigger browser download
      const link = document.createElement('a');
      link.href = material.fileUrl;
      link.download = material.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Update download count in UI
      setMaterials(materials.map(m =>
        m.id === material.id ? { ...m, downloadCount: m.downloadCount + 1 } : m
      ));
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (!confirm('Are you sure you want to delete this material?')) return;

    try {
      const response = await fetch(`/api/materials/${materialId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Material deleted');
        fetchMaterials();
      } else {
        toast.error('Failed to delete material');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete material');
    }
  };

  const getFileIcon = (fileType: string) => {
    const iconMap: Record<string, string> = {
      'pdf': '📄',
      'ppt': '📊',
      'pptx': '📊',
      'doc': '📝',
      'docx': '📝',
      'xls': '📈',
      'xlsx': '📈',
      'image': '🖼️',
      'video': '🎥',
      'youtube': '📺',
      'other': '📎',
    };
    return iconMap[fileType] || '📎';
  };

  const getYouTubeVideoId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const filteredMaterials = materials.filter(m => {
    const matchesCategory = selectedCategory ? m.categoryId === selectedCategory : true;
    const matchesSearch = searchQuery
      ? m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.fileName.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* Header with upload and search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:w-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search materials..."
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        {isTeacher && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowCategoryModal(true)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
            >
              + Category
            </button>
            <button
              onClick={() => setShowYoutubeModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              📺 YouTube
            </button>
            <label className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer text-sm">
              {uploadingFile ? 'Uploading...' : '+ Upload File'}
              <input
                type="file"
                onChange={handleFileUpload}
                disabled={uploadingFile}
                className="hidden"
                accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp4,.mov"
              />
            </label>
          </div>
        )}
      </div>

      {/* Category filters */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1 rounded-full text-sm ${
            selectedCategory === null
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All ({materials.length})
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`px-3 py-1 rounded-full text-sm ${
              selectedCategory === category.id
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {category.name} ({materials.filter(m => m.categoryId === category.id).length})
          </button>
        ))}
      </div>

      {/* Materials grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMaterials.map((material) => {
          const isYoutube = material.fileType === 'youtube';
          const videoId = isYoutube ? getYouTubeVideoId(material.fileUrl) : null;
          
          return (
            <div
              key={material.id}
              className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* YouTube thumbnail or icon */}
              {isYoutube && videoId ? (
                <div className="relative w-full pt-[56.25%] bg-black">
                  <img
                    src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                    alt={material.title}
                    className="absolute top-0 left-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-50 transition-opacity">
                    <span className="text-6xl">▶️</span>
                  </div>
                </div>
              ) : (
                <div className="p-4 flex items-start gap-3">
                  <span className="text-4xl">{getFileIcon(material.fileType)}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate" title={material.title}>
                      {material.title}
                    </h3>
                  </div>
                </div>
              )}

              <div className="p-4">
                {isYoutube && (
                  <h3 className="font-semibold text-gray-900 mb-2">{material.title}</h3>
                )}
                {material.description && (
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                    {material.description}
                  </p>
                )}
                <div className="flex flex-col gap-1 text-xs text-gray-500">
                  {!isYoutube && <div>Size: {(material.fileSize / 1024).toFixed(2)} KB</div>}
                  <div>By: {material.uploaderName}</div>
                  {!isYoutube && <div>Downloads: {material.downloadCount}</div>}
                  {isYoutube && <div>Views: {material.downloadCount}</div>}
                  {material.categoryName && (
                    <div className="text-primary-600">📁 {material.categoryName}</div>
                  )}
                </div>
                
                <div className="flex gap-2 mt-3">
                  {isYoutube ? (
                    <a
                      href={material.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        // Track view
                        fetch(`/api/materials/${material.id}/download`, { method: 'POST' });
                      }}
                      className="flex-1 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm text-center"
                    >
                      📺 Watch
                    </a>
                  ) : (
                    <button
                      onClick={() => handleDownload(material)}
                      className="flex-1 px-3 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm"
                    >
                      ⬇ Download
                    </button>
                  )}
                  {isTeacher && (
                    <button
                      onClick={() => handleDeleteMaterial(material.id)}
                      className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredMaterials.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No materials found</p>
          {isTeacher && (
            <p className="text-sm mt-2">Click "Upload File" to add materials</p>
          )}
        </div>
      )}

      {/* Category creation modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Create Category</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category Name *</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., Lecture Notes, Assignments"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={newCategoryDesc}
                  onChange={(e) => setNewCategoryDesc(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowCategoryModal(false);
                    setNewCategoryName('');
                    setNewCategoryDesc('');
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCategory}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* YouTube video addition modal */}
      {showYoutubeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">📺 Add YouTube Video</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">YouTube URL *</label>
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Paste the YouTube video URL (e.g., youtube.com/watch?v=... or youtu.be/...)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input
                  type="text"
                  value={youtubeTitle}
                  onChange={(e) => setYoutubeTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Video title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={youtubeDesc}
                  onChange={(e) => setYoutubeDesc(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowYoutubeModal(false);
                    setYoutubeUrl('');
                    setYoutubeTitle('');
                    setYoutubeDesc('');
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddYoutube}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Add Video
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
