export type Role = 'ADMIN' | 'MANAGER' | 'SITE_MANAGER' | 'USER';

export interface User {
  id: string;
  name: string;
  username: string; // [NEW]
  password?: string; // [NEW] - Optional primarily for security best practices (should be hashed in real app) but needed for this mock auth
  email?: string; // Made optional as per request to remove it from creation
  role: Role;
  avatarUrl?: string;
  assignedCompanyIds: string[];
  assignedSiteIds: string[];
  permissions: Record<string, string[]>; // e.g., ['VIEW', 'CREATE']
  editLookbackDays?: number; // [NEW] Max days allowed to edit in past for Restricted users
  status?: 'ACTIVE' | 'INACTIVE'; // [NEW]
}

export interface Company {
  id: string;
  name: string;
  logoUrl?: string;
  address?: string;
  status?: 'ACTIVE' | 'INACTIVE'; // [NEW]
  stamp?: string; // [NEW] Base64 Kaşe Image
  letterhead?: string; // [NEW] Base64 Antet Image
  taxNumber?: string; // [NEW]
  phone?: string; // [NEW]
  smtpConfig?: SmtpConfig; // [NEW] Per-company SMTP settings
  currentDocumentNumber?: number; // [NEW] Document Tracking
  shortName?: string; // [NEW]
}

export interface SitePartner {
  id: string;
  siteId: string;
  companyId: string;
  percentage: number;
}

export interface Site {
  id: string;
  companyId: string;
  name: string; // İşin Adı
  location: string; // Yer / Konum
  status: 'ACTIVE' | 'INACTIVE' | 'COMPLETED';

  // [NEW] Detailed Construction Project Info
  // [NEW] Detailed Construction Project Info
  workGroup?: string; // İş Grubu (e.g. Üstyapı, Altyapı)
  similarWorks?: { group: string; code?: string; amount?: number; }[]; // [NEW] Relation
  orderNo?: string; // S.No
  projectNo?: string; // Etap Proje No
  registrationNo?: string; // İhale Kayıt Numarası
  announcementDate?: string; // İlan Tarihi
  tenderDate?: string; // İhale Tarihi
  contractDate?: string; // Sözleşme Tarihi
  siteDeliveryDate?: string; // İşyeri Teslim Tarihi
  contractYiUfe?: number; // Sözleşme Ayı Yi-Üfe Oranı
  priceDifferenceCoefficient?: number; // Fiyat Farkı Katsayısı

  // Joint Venture
  partnershipPercentage?: number; // Ratio for Main Company
  partners?: SitePartner[]; // [NEW] Multiple Partners

  contractPrice?: number; // Sözleşme Bedeli (KDV ve F.F. Hariç)
  remainingAmount?: number; // F.F. Dahil Kalan Tutar (KDV Hariç)
  realizedAmount?: number; // Sözleşme Fiyatlarıyla Gerçekleşen Tutar (KDV ve F.F. Hariç)
  kdv?: number; // KDV Oranı (%)
  provisionalAcceptanceDate?: string; // Geçici Kabul Tarihi
  finalAcceptanceDate?: string; // Kesin Kabul Tarihi
  workExperienceCertificate?: string; // İş Deneyim Belgesi
  completionDate?: string; // İş Bitim Tarihi (Normal)
  extendedDate?: string; // Süre Uzatımlı İş Bitim Tarihi
  statusDetail?: string; // Durum Detayı (Table text)
  provisionalAcceptanceDoc?: string; // [NEW] Geçici Kabul Tutanağı (URL/Base64)
  finalAcceptanceDoc?: string; // [NEW] Kesin Kabul Tutanağı (URL/Base64)
  workExperienceDoc?: string; // [NEW] İş Deneyim Belgesi (URL/Base64)
  completionPercentage?: number; // Fiziki Gerçekleşme Oranı (%) (KEPT for safety, but UI might use partnership)
  contractToCurrentUfeRatio?: number; // [NEW] Sözleşme Ufe / Güncel Ufe
  currentUfeDate?: string; // [NEW] Güncel Ufe Tarihi
  currentWorkExperienceAmount?: number; // [NEW] Güncel İş Deneyim Tutarı
  priceDifference?: number; // [NEW] Fiyat Farkı
  personnelCount?: number; // Ortalama Çalıştırılan Personel
  note?: string;
}

export interface InsuranceRecord {
  id: string;
  type: 'TRAFFIC' | 'KASKO';
  company: string; // Firm (Provider)
  agency: string; // Agency
  startDate: string;
  endDate: string;
  cost: number;
  active: boolean; // Is this the currently shown policy?
  attachments?: string[]; // [NEW] Base64 strings for files
  definition?: string;
  identificationNumber?: string; // [NEW] Policy Number
  transactionDate?: string; // [NEW] İşlem Tarihi
}

export interface Vehicle {
  id: string;
  companyId: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  type: 'TRUCK' | 'LORRY' | 'CAR' | 'EXCAVATOR' | 'TRACTOR' | 'OTHER'; // [MODIFIED] TRUCK=Kamyon, LORRY=Tır
  meterType: 'KM' | 'HOURS'; // [NEW] KM or Working Hours
  currentKm: number; // This will hold either KM or Hours value
  insuranceExpiry: string; // ISO Date
  insuranceStartDate?: string; // [NEW] ISO Date
  kaskoExpiry: string; // ISO Date
  kaskoStartDate?: string; // [NEW] ISO Date
  inspectionExpiry?: string; // [NEW] Muayene Bitiş Tarihi
  insuranceAgency?: string; // [MODIFIED] Acente (Aracı)
  insuranceCompany?: string; // [NEW] Sigorta Firması (Sağlayıcı)
  kaskoAgency?: string; // [MODIFIED] Kasko Acentesi (Aracı)
  kaskoCompany?: string; // [NEW] Kasko Firması (Sağlayıcı)
  insuranceCost?: number; // [NEW] Sigorta Tutarı
  kaskoCost?: number; // [NEW] Kasko Tutarı
  definition?: string; // [NEW] Cinsi (e.g. Kamyon, Tır, Binek - more specific text)
  insuranceHistory?: InsuranceRecord[]; // [NEW] Past records
  status: 'ACTIVE' | 'MAINTENANCE' | 'SOLD' | 'PASSIVE';
  assignedSiteId?: string; // Where is it currently working?
  assignedSiteIds?: string[]; // [NEW] Multiple sites assignment
  ownership: 'OWNED' | 'RENTAL'; // [NEW] Owned or Rental
  rentalCompanyName?: string; // [NEW] For rental vehicles, manual entry
  monthlyRentalFee?: number; // [NEW] Aylık Kira Bedeli + KDV
  rentalContact?: string; // [NEW] Contact info for rental vehicles
  rentalCost?: number; // [NEW]
  rentalLastUpdate?: string; // [NEW]
  engineNumber?: string; // [NEW] Motor No
  chassisNumber?: string; // [NEW] Şase No
  fuelType?: 'DIESEL' | 'GASOLINE' | 'LPG' | 'ELECTRIC' | 'HYBRID'; // [NEW] Yakıt Tipi
  lastInspectionDate?: string; // [NEW] Son Muayane Tarihi
  licenseFile?: string; // [NEW] Ruhsat (PDF Base64)
}

// [NEW] Fuel Stock Management
export interface FuelTank {
  id: string;
  siteId: string;
  name: string; // e.g., "Ana Depo 1"
  capacity: number; // Max Liters
  currentLevel: number; // Current Liters
}

export interface FuelTransfer { // Virman
  id: string;
  fromType: 'TANK' | 'VEHICLE' | 'EXTERNAL'; // External = Satın Alma
  fromId: string; // Tank ID or Vehicle ID or 'External Company Name'
  toType: 'TANK' | 'VEHICLE';
  toId: string;
  date: string;
  amount: number; // Liters
  description?: string;
  unitPrice?: number; // [NEW] Birim Fiyat (TL)
  totalCost?: number; // [NEW] Toplam Tutar (TL)
  createdByUserId: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  fromEmail: string;
  fromName: string;
}

export interface FuelLog {
  id: string;
  vehicleId: string;
  siteId: string; // Where was it fueled?
  tankId?: string; // [NEW] Which tank was used? (Optional if external)
  date: string; // ISO Date
  liters: number;
  cost: number;
  mileage: number; // KM or Hours at filling
  fullTank: boolean; // [NEW] Was the tank filled completely?
  filledByUserId: string;
  description?: string; // [NEW] Notes/Description for the log
  unitPrice?: number; // [NEW] Birim Fiyat
}

export interface Correspondence { // Yazışmalar
  id: string;
  companyId: string;
  siteId?: string; // [NEW] Optional Site Selection
  date: string;
  direction: 'INCOMING' | 'OUTGOING';
  type: 'OFFICIAL' | 'INTERNAL' | 'BANK' | 'OTHER';
  subject: string;
  description: string;
  referenceNumber: string;
  senderReceiver: string;
  attachmentUrls?: string[];
  createdByUserId: string;
  status?: 'ACTIVE' | 'DELETED';
  deletionReason?: string;
  deletedByUserId?: string;
  deletionDate?: string;
  senderReceiverAlignment?: 'left' | 'center' | 'right';
  interest?: string[]; // [NEW] İlgi (A, B, C...)
  appendices?: string[]; // [NEW] Ekler (1, 2, 3...)
  registrationNumber?: string; // [NEW] Evrak Kayıt Numarası
  includeStamp?: boolean; // [NEW] Kaşe Ekle
  createdAt?: string; // ISO Date
  updatedAt?: string; // ISO Date
}

export interface CashTransaction { // Kasa Defteri
  id: string;
  siteId: string;
  date: string;
  type: 'INCOME' | 'EXPENSE' | 'BALANCE_START';
  category: string;
  amount: number;
  description: string;
  documentNo?: string;
  approvedByUserId?: string;
  createdByUserId: string;
  responsibleUserId?: string; // [NEW] Who spent/received the money
  createdAt?: string; // Entry timestamp
}

export interface Personnel {
  id: string;
  fullName: string;
  role: string; // e.g. "Foreman", "Worker"
  tcNumber: string; // [NEW] 11 digits
  profession: string; // [NEW] Mesleği
  salary: number; // [NEW] Maaş
  siteId: string; // [NEW] Şantiye
  category: 'TECHNICAL' | 'FIELD'; // [NEW] Personel Grubu: Teknik veya Saha
  status?: 'ACTIVE' | 'LEFT'; // [NEW] Durum: Çalışıyor veya Ayrıldı
  leftDate?: string; // [NEW] İşten ayrılma tarihi (ISO)
  note?: string; // [NEW] Notlar
  transferHistory?: { fromSiteId: string; toSiteId: string; date: string; }[]; // [NEW] Transfer geçmişi
  monthlyLeaveAllowance?: number; // [NEW] Aylık İzin Hakkı (Gün)
  isOvertimeAllowed?: boolean; // [NEW] Mesai Hakkı Var mı?
  salaryHistory?: { amount: number; validFrom: string; }[]; // [NEW] Maaş Geçmişi
  startDate?: string; // [NEW] İşe Başlama Tarihi
  employmentHistory?: { type: 'HIRE' | 'EXIT'; date: string; }[]; // [NEW] İşe Giriş / Çıkış Geçmişi
}

export interface PersonnelAttendance { // Personel Puantaj
  id: string;
  personnelId: string;
  siteId: string;
  date: string; // YYYY-MM-DD
  status: 'WORK' | 'LEAVE' | 'SICK' | 'ABSENT' | 'REPORT' | 'HALF_DAY' | 'OUT_DUTY'; // [NEW] Added statuses
  hours: number;
  overtime?: number; // [NEW] Mesai saati
  note?: string; // [NEW] Gerekçe
  weather?: string; // [NEW] Hava durumu icon key (e.g. 'sunny', 'rainy')
  createdByUserId?: string; // [NEW] Who entered the record
}

export interface VehicleAttendance { // Araç Puantaj
  id: string;
  vehicleId: string;
  siteId: string;
  date: string;
  status: 'WORK' | 'HALF_DAY' | 'IDLE' | 'REPAIR' | 'NO_OPERATOR' | 'HOLIDAY';
  hours: number;
  note?: string; // [NEW]
  createdByUserId?: string; // [NEW] Who entered the record
}

export interface SiteLogEntry { // Şantiye Defteri
  id: string;
  siteId: string;
  date: string;
  weather?: string;
  temperature?: number;
  content: string; // Markdown supported
  authorId: string;
  tags?: string[];
  images?: string[];
}

export interface YiUfeRate {
  id: string;
  year: number;
  month: number;
  index: number;
}

export interface Institution {
  id: string;
  name: string;
  alignment?: 'left' | 'center' | 'right';
  category?: 'BANK' | 'INSTITUTION' | 'INSURANCE_COMPANY' | 'INSURANCE_AGENCY';
  email?: string;
  phone?: string;
  mobile?: string;
  contactPerson?: string;
  shortName?: string; // [NEW]
}

// Re-opening Vehicle interface to add new fields (or just editing the existing one if I had the full file context in one go, but here I'm appending/editing the end of file? No, I need to edit the Vehicle interface earlier in the file. Wait, I should edit the Vehicle interface block directly. I will use a separate tool call for that or just do it here if possible. Actually, I can't edit non-contiguous blocks with this tool. I will only update Institution here and use another call for Vehicle.)

export interface AppState {
  companies: Company[];
  sites: Site[];
  users: User[];
  vehicles: Vehicle[];
  correspondences: Correspondence[];
  cashTransactions: CashTransaction[];
  personnel: Personnel[];
  personnelAttendance: PersonnelAttendance[];
  vehicleAttendance: VehicleAttendance[];
  siteLogEntries: SiteLogEntry[];
  fuelLogs: FuelLog[];
  fuelTanks: FuelTank[];
  fuelTransfers: FuelTransfer[];
  yiUfeRates: YiUfeRate[];
  institutions: Institution[];
  addCompany: (company: Company) => void;
  updateCompany: (id: string, updates: Partial<Company>) => void;
  deleteCompany: (id: string) => void;
  addSite: (site: Site) => void;
  updateSite: (id: string, updates: Partial<Site>) => void;
  deleteSite: (id: string) => void;
  assignVehiclesToSite: (vehicleIds: string[], siteIds: string[]) => void;
  setYiUfeRates: (rates: YiUfeRate[]) => void;
  addUser: (user: User) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;
  addVehicle: (vehicle: Vehicle) => void;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  deleteVehicle: (id: string) => void;
  addCorrespondence: (item: Correspondence) => void;
  deleteCorrespondence: (id: string, reason?: string, userId?: string) => void;
  restoreCorrespondence: (id: string) => void; // [NEW]
  updateCorrespondence: (id: string, updates: Partial<Correspondence>) => void;
  addCashTransaction: (item: CashTransaction) => void;
  deleteCashTransaction: (id: string) => void;
  updateCashTransaction: (id: string, updates: Partial<CashTransaction>) => void;
  addPersonnel: (p: Personnel) => void;
  updatePersonnel: (id: string, updates: Partial<Personnel>) => void;
  deletePersonnel: (id: string) => void;
  addPersonnelAttendance: (p: PersonnelAttendance) => void;
  deletePersonnelAttendance: (id: string) => void;
  addVehicleAttendance: (v: VehicleAttendance) => void;
  deleteVehicleAttendance: (id: string) => void;
  addSiteLogEntry: (entry: SiteLogEntry) => void;
  deleteSiteLogEntry: (id: string) => void;
  updateSiteLogEntry: (id: string, updates: Partial<SiteLogEntry>) => void;
  addFuelLog: (log: FuelLog) => void;
  deleteFuelLog: (id: string) => void;
  updateFuelLog: (id: string, updates: Partial<FuelLog>) => void;
  addFuelTank: (tank: FuelTank) => void;
  updateFuelTank: (id: string, updates: Partial<FuelTank>) => void;
  deleteFuelTank: (id: string) => void;
  setFuelTanks: (tanks: FuelTank[]) => void; // [NEW]
  addFuelTransfer: (transfer: FuelTransfer) => void;
  deleteFuelTransfer: (id: string) => void;
  updateFuelTransfer: (id: string, updates: Partial<FuelTransfer>) => void;
  addYiUfeRates: (rates: YiUfeRate[]) => void;
  addInstitution: (institution: Institution) => void;
  updateInstitution: (id: string, updates: Partial<Institution>) => void;
  deleteInstitution: (id: string) => void;
}
