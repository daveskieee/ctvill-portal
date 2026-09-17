/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, Clock, Users, MapPin, Plus, 
  ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, 
  Video, ShieldAlert, Tag, Filter, X, CalendarDays, Download,
  Edit3, Trash2, Check
} from 'lucide-react';
import { ScheduleEvent, ScheduleEventType, ProjectProfile } from '../types';

interface ProjectScheduleCalendarProps {
  events: ScheduleEvent[];
  projects?: ProjectProfile[];
  onAddEvent?: (event: Partial<ScheduleEvent>) => Promise<void>;
  onUpdateEvent?: (eventId: string, updates: Partial<ScheduleEvent>) => Promise<void>;
  onDeleteEvent?: (eventId: string) => Promise<void>;
}

export default function ProjectScheduleCalendar({
  events = [],
  projects = [],
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent
}: ProjectScheduleCalendarProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);

  // Add Event Form State (Empty when opened, displaying e.g. placeholders)
  const [newTitle, setNewTitle] = useState('');
  const [newProject, setNewProject] = useState('');
  const [newType, setNewType] = useState<ScheduleEventType>('MEETING');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newAttendees, setNewAttendees] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Event Form State
  const [editTitle, setEditTitle] = useState('');
  const [editProject, setEditProject] = useState('');
  const [editType, setEditType] = useState<ScheduleEventType>('MEETING');
  const [editEventDate, setEditEventDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editAttendees, setEditAttendees] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<'SCHEDULED' | 'COMPLETED' | 'CANCELLED'>('SCHEDULED');

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Filter events
  const filteredEvents = events.filter(e => {
    if (filterType !== 'ALL' && e.eventType !== filterType) return false;
    if (projectFilter !== 'ALL' && !(e.projectName || '').toLowerCase().includes(projectFilter.toLowerCase())) return false;
    return true;
  });

  // Events on selected date
  const eventsOnSelectedDate = filteredEvents.filter(e => e.eventDate === selectedDateStr);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newEventDate) return;

    setIsSubmitting(true);
    try {
      const payload: Partial<ScheduleEvent> = {
        title: newTitle.trim(),
        projectName: newProject,
        eventType: newType,
        eventDate: newEventDate,
        startTime: newStartTime,
        endTime: newEndTime,
        location: newLocation,
        attendees: newAttendees,
        notes: newNotes,
        status: 'SCHEDULED'
      };

      if (onAddEvent) {
        await onAddEvent(payload);
      } else {
        await fetch('/api/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      setShowAddModal(false);
      resetAddForm();
    } catch (err) {
      console.error('Failed to create schedule event:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAddForm = (initialDate?: string) => {
    setNewTitle('');
    setNewProject(projects && projects.length > 0 ? projects[0].name : '');
    setNewType('MEETING');
    setNewEventDate(initialDate || new Date().toISOString().split('T')[0]);
    setNewStartTime('');
    setNewEndTime('');
    setNewLocation('');
    setNewAttendees('');
    setNewNotes('');
  };

  const openAddModal = (dateStr?: string) => {
    resetAddForm(dateStr);
    setShowAddModal(true);
  };

  const openEditModal = (evt: ScheduleEvent) => {
    setEditingEvent(evt);
    setEditTitle(evt.title);
    setEditProject(evt.projectName || (projects && projects.length > 0 ? projects[0].name : ''));
    setEditType(evt.eventType);
    setEditEventDate(evt.eventDate);
    setEditStartTime(evt.startTime || '');
    setEditEndTime(evt.endTime || '');
    setEditLocation(evt.location || '');
    setEditAttendees(evt.attendees || '');
    setEditNotes(evt.notes || '');
    setEditStatus(evt.status || 'SCHEDULED');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    setIsSubmitting(true);
    try {
      const updates: Partial<ScheduleEvent> = {
        title: editTitle.trim(),
        projectName: editProject,
        eventType: editType,
        eventDate: editEventDate,
        startTime: editStartTime,
        endTime: editEndTime,
        location: editLocation,
        attendees: editAttendees,
        notes: editNotes,
        status: editStatus
      };

      if (onUpdateEvent) {
        await onUpdateEvent(editingEvent.id, updates);
      } else {
        await fetch(`/api/schedule/${editingEvent.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });
      }

      setEditingEvent(null);
    } catch (err) {
      console.error('Failed to update schedule event:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleCompleted = async (evt: ScheduleEvent) => {
    const newStatus = evt.status === 'COMPLETED' ? 'SCHEDULED' : 'COMPLETED';
    try {
      if (onUpdateEvent) {
        await onUpdateEvent(evt.id, { status: newStatus });
      } else {
        await fetch(`/api/schedule/${evt.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this scheduled event?')) return;
    if (onDeleteEvent) {
      await onDeleteEvent(id);
    } else {
      await fetch(`/api/schedule/${id}`, { method: 'DELETE' });
    }
  };

  // Export Calendar Events to CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Date', 'Start Time', 'End Time', 'Project', 'Title', 'Event Type', 'Location', 'Attendees', 'Status', 'Notes'];
    const rows = filteredEvents.map(e => [
      e.id,
      e.eventDate,
      e.startTime || '',
      e.endTime || '',
      `"${(e.projectName || '').replace(/"/g, '""')}"`,
      `"${e.title.replace(/"/g, '""')}"`,
      e.eventType,
      `"${(e.location || '').replace(/"/g, '""')}"`,
      `"${(e.attendees || '').replace(/"/g, '""')}"`,
      e.status || 'SCHEDULED',
      `"${(e.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Project_Operations_Schedule_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getBadgeStyle = (type: ScheduleEventType) => {
    switch (type) {
      case 'MEETING':
        return 'bg-blue-950/80 text-blue-300 border-blue-800';
      case 'DEADLINE':
        return 'bg-rose-950/80 text-rose-300 border-rose-800';
      case 'MILESTONE':
        return 'bg-amber-950/80 text-amber-300 border-amber-800';
      case 'INSPECTION':
        return 'bg-purple-950/80 text-purple-300 border-purple-800';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-6 rounded-2xl backdrop-blur-xl shadow-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold tracking-wider uppercase">
              Time-Critical Coordination
            </span>
            <span className="text-xs text-slate-400">Master Operations Calendar</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <CalendarDays className="w-7 h-7 text-blue-400" />
            Project Schedule & Calendar
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Interactive calendar view of project start/end dates, client coordination meetings, inspections, and deliverable deadlines.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Export (CSV)</span>
          </button>

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 font-mono"
          >
            <option value="ALL">All Commercial Projects</option>
            {projects && projects.length > 0 ? (
              projects.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))
            ) : (
              <option value="ALL" disabled>No Projects Registered</option>
            )}
            <option value="Master Operations">Master Operations (Cross-Site)</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Event Types</option>
            <option value="MEETING">Meetings</option>
            <option value="INSPECTION">Ocular Inspections</option>
            <option value="MILESTONE">Milestones</option>
            <option value="DEADLINE">Deadlines</option>
          </select>

          <button
            onClick={() => openAddModal(selectedDateStr)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition shadow-lg shadow-blue-500/20 text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Schedule Event
          </button>
        </div>
      </div>

      {/* Main Grid: Calendar on Left, Selected Date Agenda on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Calendar View (Span 2) */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            {/* Month Header Navigation */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-blue-400" />
                {monthName} {year}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={prevMonth}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white font-mono transition cursor-pointer"
                >
                  Today
                </button>
                <button
                  onClick={nextMonth}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Days of week */}
            <div className="grid grid-cols-7 gap-1 text-center font-mono text-[11px] text-slate-400 uppercase pb-2 border-b border-slate-800">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* Calendar Days Matrix */}
            <div className="grid grid-cols-7 gap-1.5 pt-2">
              {/* Empty leading tiles */}
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[76px] rounded-xl bg-slate-950/20 border border-transparent" />
              ))}

              {/* Month days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const paddedMonth = String(month + 1).padStart(2, '0');
                const paddedDay = String(day).padStart(2, '0');
                const dateKey = `${year}-${paddedMonth}-${paddedDay}`;
                const isSelected = selectedDateStr === dateKey;
                const isToday = dateKey === new Date().toISOString().split('T')[0];

                const dayEvents = filteredEvents.filter(e => e.eventDate === dateKey);

                return (
                  <div
                    key={dateKey}
                    onClick={() => setSelectedDateStr(dateKey)}
                    className={`min-h-[76px] p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-950/40 border-blue-500 shadow-md shadow-blue-500/10'
                        : isToday
                        ? 'bg-slate-900 border-amber-500/50'
                        : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`text-xs font-mono font-bold ${
                        isSelected ? 'text-blue-300' : isToday ? 'text-amber-400' : 'text-slate-300'
                      }`}>
                        {day}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                      )}
                    </div>

                    <div className="space-y-1 mt-1 overflow-hidden">
                      {dayEvents.slice(0, 2).map((evt, idx) => (
                        <div
                          key={idx}
                          className={`text-[9px] truncate px-1.5 py-0.5 rounded border ${
                            evt.status === 'COMPLETED' 
                              ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300 line-through opacity-75' 
                              : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                        >
                          {evt.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="text-[9px] text-slate-500 block">
                          +{dayEvents.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400 mt-6 pt-4 border-t border-slate-800">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> Meeting
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> Inspection
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Milestone
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> Deadline
            </span>
          </div>
        </div>

        {/* Selected Date Agenda View (Span 1) */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Selected Date Agenda</span>
                <h3 className="text-base font-bold text-white font-mono">{selectedDateStr}</h3>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-slate-300">
                {eventsOnSelectedDate.length} {eventsOnSelectedDate.length === 1 ? 'Event' : 'Events'}
              </span>
            </div>

            <div className="mt-4 space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {eventsOnSelectedDate.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs italic">
                  No scheduled activities on this date. Click &quot;Add Event&quot; to plan a meeting or milestone.
                </div>
              ) : (
                eventsOnSelectedDate.map((evt) => (
                  <div
                    key={evt.id}
                    className={`p-4 rounded-xl border transition ${
                      evt.status === 'COMPLETED'
                        ? 'bg-slate-950/60 border-emerald-900/50'
                        : 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getBadgeStyle(evt.eventType)}`}>
                            {evt.eventType}
                          </span>
                          {evt.status === 'COMPLETED' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                              ✓ Completed
                            </span>
                          )}
                        </div>
                        <h4 className={`text-xs font-bold mt-1.5 leading-snug ${
                          evt.status === 'COMPLETED' ? 'text-slate-400 line-through' : 'text-white'
                        }`}>
                          {evt.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleCompleted(evt)}
                          className={`p-1 rounded transition cursor-pointer ${
                            evt.status === 'COMPLETED' 
                              ? 'text-emerald-400 hover:text-slate-400' 
                              : 'text-slate-500 hover:text-emerald-400'
                          }`}
                          title={evt.status === 'COMPLETED' ? 'Mark Incomplete' : 'Mark Completed'}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(evt)}
                          className="p-1 text-slate-400 hover:text-blue-400 transition cursor-pointer"
                          title="Edit Event"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(evt.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 transition cursor-pointer"
                          title="Delete Event"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-[11px] text-amber-400 font-medium">{evt.projectName}</div>

                    <div className="space-y-1 text-[11px] text-slate-400 font-mono pt-1">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-blue-400" />
                        {evt.startTime} - {evt.endTime}
                      </div>
                      {evt.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span className="truncate">{evt.location}</span>
                        </div>
                      )}
                      {evt.attendees && (
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3 h-3 text-purple-400" />
                          <span className="truncate">{evt.attendees}</span>
                        </div>
                      )}
                    </div>

                    {evt.notes && (
                      <p className="text-[10px] text-slate-500 bg-slate-900/80 p-2 rounded border border-slate-800 mt-2">
                        {evt.notes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800">
            <button
              onClick={() => openAddModal(selectedDateStr)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-blue-300 bg-blue-950/60 hover:bg-blue-900/60 border border-blue-800 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Event on {selectedDateStr}
            </button>
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-bold text-white">Schedule Activity / Meeting</h3>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Event Title / Purpose</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Subcontractor Milestone Sign-Off Ocular"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Commercial Project</label>
                  <select
                    value={newProject}
                    onChange={(e) => setNewProject(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    {projects && projects.length > 0 ? (
                      projects.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name}
                        </option>
                      ))
                    ) : (
                      <option value="">-- No Projects Registered --</option>
                    )}
                    <option value="Master Operations">Master Operations (Cross-Site)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Event Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as ScheduleEventType)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="MEETING">Client/Subcon Meeting</option>
                    <option value="INSPECTION">Ocular / QA Inspection</option>
                    <option value="MILESTONE">Milestone Handover</option>
                    <option value="DEADLINE">Contractual Deadline</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Start Time</label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">End Time</label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Location / Platform</label>
                <input
                  type="text"
                  placeholder="e.g. 5th Floor Conference Room or Zoom Link"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Attendees & Stakeholders</label>
                <input
                  type="text"
                  placeholder="e.g. Lead Architect, QA Inspector, Subcon Supervisor"
                  value={newAttendees}
                  onChange={(e) => setNewAttendees(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Agenda & Preparatory Notes</label>
                <textarea
                  rows={2}
                  placeholder="Discuss electrical load balance, MEPFS rough-in inspection sign-off..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Scheduling...' : 'Save Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {editingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingEvent(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Edit3 className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-bold text-white">Edit Scheduled Activity</h3>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Event Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Project</label>
                  <select
                    value={editProject}
                    onChange={(e) => setEditProject(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    {projects && projects.length > 0 ? (
                      projects.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name}
                        </option>
                      ))
                    ) : (
                      <option value="">-- No Projects Registered --</option>
                    )}
                    <option value="Master Operations">Master Operations (Cross-Site)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Event Type</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as ScheduleEventType)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="MEETING">Client/Subcon Meeting</option>
                    <option value="INSPECTION">Ocular / QA Inspection</option>
                    <option value="MILESTONE">Milestone Handover</option>
                    <option value="DEADLINE">Contractual Deadline</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={editEventDate}
                    onChange={(e) => setEditEventDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Start Time</label>
                  <input
                    type="time"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">End Time</label>
                  <input
                    type="time"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Location / Platform</label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="SCHEDULED">SCHEDULED</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Attendees</label>
                <input
                  type="text"
                  value={editAttendees}
                  onChange={(e) => setEditAttendees(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
