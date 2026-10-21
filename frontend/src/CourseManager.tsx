import { useState, useEffect } from "react";
import axios from "axios";

// Match the backend Pydantic schema
interface Course {
  id: number;
  course_code: string;
  title: string;
  description: string;
}

const API_URL = import.meta.env.PROD ? "/api/courses/" : "http://localhost:8000/courses/";
export default function CourseManager() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState({ course_code: "", title: "", description: "" });
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    const response = await axios.get(API_URL);
    setCourses(response.data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await axios.put(`${API_URL}${editingId}`, { title: form.title, description: form.description });
    } else {
      await axios.post(API_URL, form);
    }
    setForm({ course_code: "", title: "", description: "" });
    setEditingId(null);
    fetchCourses();
  };

  const handleDelete = async (id: number) => {
    await axios.delete(`${API_URL}${id}`);
    fetchCourses();
  };

  const handleEdit = (course: Course) => {
    setForm({ course_code: course.course_code, title: course.title, description: course.description });
    setEditingId(course.id);
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h2>Course Enrollment MVP</h2>
      
      <form onSubmit={handleSubmit} style={{ marginBottom: "20px" }}>
        <input 
          placeholder="Course Code" 
          value={form.course_code} 
          onChange={(e) => setForm({ ...form, course_code: e.target.value })} 
          disabled={!!editingId}
          required 
          style={{ marginRight: "10px" }}
        />
        <input 
          placeholder="Title" 
          value={form.title} 
          onChange={(e) => setForm({ ...form, title: e.target.value })} 
          required 
          style={{ marginRight: "10px" }}
        />
        <input 
          placeholder="Description" 
          value={form.description} 
          onChange={(e) => setForm({ ...form, description: e.target.value })} 
          required 
          style={{ marginRight: "10px" }}
        />
        <button type="submit">{editingId ? "Update Course" : "Add Course"}</button>
        {editingId && <button type="button" onClick={() => { setEditingId(null); setForm({ course_code: "", title: "", description: "" }); }}>Cancel</button>}
      </form>

      <table border={1} cellPadding={10} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th>Code</th>
            <th>Title</th>
            <th>Description</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => (
            <tr key={course.id}>
              <td>{course.course_code}</td>
              <td>{course.title}</td>
              <td>{course.description}</td>
              <td>
                <button onClick={() => handleEdit(course)} style={{ marginRight: "10px" }}>Edit</button>
                <button onClick={() => handleDelete(course.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}