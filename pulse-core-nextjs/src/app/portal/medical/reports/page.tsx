'use client';

import { useState } from 'react';
import { ReportLayout, ReportKPIGrid, FilterPanel, FilterSelect, ChartContainer } from '@/components/reports/ReportLayout';
import { KPICard } from '@/components/ui/KPICard';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PageSection } from '@/components/ui/PageLayout';
import { getDefaultDateRange, DateRangeValue } from '@/components/ui/DateRangePicker';
import { 
  Users, 
  Stethoscope, 
  Clock, 
  AlertCircle,
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// Mock data - replace with actual API calls
const consultationTrendData = [
  { date: 'Mon', consultations: 45, avgDuration: 18 },
  { date: 'Tue', consultations: 52, avgDuration: 20 },
  { date: 'Wed', consultations: 48, avgDuration: 19 },
  { date: 'Thu', consultations: 61, avgDuration: 22 },
  { date: 'Fri', consultations: 55, avgDuration: 21 },
  { date: 'Sat', consultations: 38, avgDuration: 17 },
  { date: 'Sun', consultations: 25, avgDuration: 16 },
];

const departmentData = [
  { name: 'General', value: 125, color: '#3B8B6E' },
  { name: 'Cardiology', value: 89, color: '#2E86AB' },
  { name: 'Pediatrics', value: 76, color: '#7B61C1' },
  { name: 'Orthopedics', value: 54, color: '#D4763C' },
  { name: 'Dermatology', value: 43, color: '#3282B8' },
];

const recentConsultations = [
  { id: '1', patient: 'John Doe', doctor: 'Dr. Smith', department: 'General', time: '09:30 AM', duration: '15 min', status: 'Completed' },
  { id: '2', patient: 'Jane Smith', doctor: 'Dr. Johnson', department: 'Cardiology', time: '10:15 AM', duration: '25 min', status: 'In Progress' },
  { id: '3', patient: 'Mike Brown', doctor: 'Dr. Davis', department: 'Pediatrics', time: '10:45 AM', duration: '18 min', status: 'Completed' },
  { id: '4', patient: 'Sarah Wilson', doctor: 'Dr. Miller', department: 'Orthopedics', time: '11:00 AM', duration: '30 min', status: 'Waiting' },
  { id: '5', patient: 'Tom Johnson', doctor: 'Dr. Garcia', department: 'General', time: '11:30 AM', duration: '20 min', status: 'Scheduled' },
];

export default function MedicalReportsPage() {
  const [dateRange, setDateRange] = useState<DateRangeValue>(getDefaultDateRange());
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDateRangeChange = (value: DateRangeValue) => {
    setLoading(true);
    setDateRange(value);
    setTimeout(() => setLoading(false), 500);
  };

  const handleExportCSV = () => {
    const headers = ['Patient', 'Doctor', 'Department', 'Time', 'Duration', 'Status'];
    const csvContent = [
      headers.join(','),
      ...recentConsultations.map(row => [
        row.patient,
        row.doctor,
        row.department,
        row.time,
        row.duration,
        row.status
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `medical-consultations-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const handleExportPDF = () => window.print();

  const consultationColumns: Column<typeof recentConsultations[0]>[] = [
    { key: 'patient', header: 'Patient', accessor: (row) => row.patient, sortable: true },
    { key: 'doctor', header: 'Doctor', accessor: (row) => row.doctor, sortable: true },
    { key: 'department', header: 'Department', accessor: (row) => row.department, sortable: true },
    { key: 'time', header: 'Time', accessor: (row) => row.time, sortable: true },
    { key: 'duration', header: 'Duration', accessor: (row) => row.duration, sortable: true },
    { 
      key: 'status', 
      header: 'Status', 
      accessor: (row) => (
        <span className={`
          inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
          ${row.status === 'Completed' ? 'bg-green-100 text-green-800' : 
            row.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 
            row.status === 'Waiting' ? 'bg-yellow-100 text-yellow-800' : 
            'bg-gray-100 text-gray-800'}
        `}>
          {row.status}
        </span>
      ),
      sortable: true 
    },
  ];

  return (
    <ReportLayout
      title="Medical Portal Reports"
      description="Analyze patient consultations, department performance, and clinical metrics"
      breadcrumbs={[
        { label: 'Medical', href: '/portal/medical' },
        { label: 'Reports' }
      ]}
      dateRange={dateRange}
      onDateRangeChange={handleDateRangeChange}
      onExportCSV={handleExportCSV}
      onExportPDF={handleExportPDF}
      onPrint={() => window.print()}
      filters={
        <FilterPanel>
          <FilterSelect
            label="Department"
            value={departmentFilter}
            onChange={setDepartmentFilter}
            placeholder="All Departments"
            options={[
              { value: 'general', label: 'General' },
              { value: 'cardiology', label: 'Cardiology' },
              { value: 'pediatrics', label: 'Pediatrics' },
              { value: 'orthopedics', label: 'Orthopedics' },
              { value: 'dermatology', label: 'Dermatology' },
            ]}
          />
          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="All Statuses"
            options={[
              { value: 'completed', label: 'Completed' },
              { value: 'in-progress', label: 'In Progress' },
              { value: 'waiting', label: 'Waiting' },
              { value: 'scheduled', label: 'Scheduled' },
            ]}
          />
        </FilterPanel>
      }
    >
      <div className="space-y-6">
        {/* KPI Cards */}
        <ReportKPIGrid>
          <KPICard
            title="Total Consultations"
            value={324}
            icon={Stethoscope}
            subtitle="Last 7 days"
            trend={{ value: 12, label: 'vs previous week' }}
            portal="medical"
            loading={loading}
          />
          <KPICard
            title="Active Patients"
            value={48}
            icon={Users}
            subtitle="Currently in queue"
            trend={{ value: -5, label: 'vs yesterday' }}
            portal="medical"
            loading={loading}
          />
          <KPICard
            title="Avg Consult Time"
            value="19 min"
            icon={Clock}
            subtitle="Per patient"
            trend={{ value: 8, label: 'vs target' }}
            portal="medical"
            loading={loading}
          />
          <KPICard
            title="Critical Alerts"
            value={3}
            icon={AlertCircle}
            subtitle="Requiring attention"
            trend={{ value: 0, label: 'No change' }}
            portal="medical"
            loading={loading}
          />
        </ReportKPIGrid>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartContainer
            title="Consultation Trends"
            description="Daily consultation volume and average duration"
            loading={loading}
            height={300}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={consultationTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" stroke="#64748B" fontSize={12} />
                <YAxis stroke="#64748B" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #E2E8F0', 
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="consultations" 
                  name="Consultations" 
                  stroke="#3B8B6E" 
                  strokeWidth={2}
                  dot={{ fill: '#3B8B6E', strokeWidth: 2 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="avgDuration" 
                  name="Avg Duration (min)" 
                  stroke="#2E86AB" 
                  strokeWidth={2}
                  dot={{ fill: '#2E86AB', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>

          <ChartContainer
            title="Department Distribution"
            description="Consultations by department"
            loading={loading}
            height={300}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={departmentData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {departmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #E2E8F0', 
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        {/* Data Table */}
        <PageSection title="Recent Consultations" description="Latest patient consultations">
          <DataTable
            data={recentConsultations}
            columns={consultationColumns}
            keyExtractor={(row) => row.id}
            searchable
            searchPlaceholder="Search patients or doctors..."
            exportable
            exportFilename="consultations"
          />
        </PageSection>
      </div>
    </ReportLayout>
  );
}
