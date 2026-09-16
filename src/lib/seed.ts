import { faker } from '@faker-js/faker';
import { db } from './firebase';
import { collection, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { DEPARTMENTS } from '../constants';

export async function seedDatabase(patientCount = 100, doctorCount = 30) {
  const batch = writeBatch(db);
  const usersRef = collection(db, 'users');
  
  const doctorIds: string[] = [];
  const patientIds: string[] = [];

  // Generate Doctors
  for (let i = 0; i < doctorCount; i++) {
    const userId = faker.string.uuid();
    const dept = faker.helpers.arrayElement(DEPARTMENTS);
    const doctorData = {
      userId,
      name: `Dr. ${faker.person.fullName()}`,
      email: faker.internet.email(),
      role: 'doctor',
      createdAt: Timestamp.now().toDate().toISOString(),
      department: dept.name,
      specialty: faker.helpers.arrayElement(dept.subSpecialties || [dept.name])
    };
    
    const docRef = doc(usersRef, userId);
    batch.set(docRef, doctorData);
    
    // Add internal profile
    const profileRef = doc(db, 'users', userId, 'doctorData', 'profile');
    batch.set(profileRef, {
      specialty: doctorData.specialty,
      department: doctorData.department,
      experience: faker.number.int({ min: 2, max: 40 }),
      bio: faker.lorem.paragraph(),
      licenseNumber: `MED-${faker.string.alphanumeric(8).toUpperCase()}`,
      availability: ["Mon 08:00-16:00", "Wed 10:00-18:00", "Fri 08:00-14:00"]
    });
    
    doctorIds.push(userId);
  }

  // Generate Patients
  for (let i = 0; i < patientCount; i++) {
    const userId = faker.string.uuid();
    const patientData = {
      userId,
      name: faker.person.fullName(),
      email: faker.internet.email(),
      role: 'patient',
      createdAt: faker.date.past().toISOString()
    };
    
    const docRef = doc(usersRef, userId);
    batch.set(docRef, patientData);
    
    // Add internal profile
    const profileRef = doc(db, 'users', userId, 'patientData', 'profile');
    batch.set(profileRef, {
      age: faker.number.int({ min: 1, max: 95 }),
      gender: faker.helpers.arrayElement(['Male', 'Female', 'Other']),
      medicalHistory: faker.lorem.sentence(),
      bloodType: faker.helpers.arrayElement(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']),
      emergencyContact: faker.phone.number(),
      allergies: faker.helpers.arrayElements(['Peanuts', 'Penicillin', 'Latex', 'Dust'], { min: 0, max: 2 }),
      medications: faker.helpers.arrayElements(['Lipitor', 'Metformin', 'Lisinopril', 'Albuterol'], { min: 0, max: 1 })
    });
    
    patientIds.push(userId);
  }

  await batch.commit();

  // Second phase: Appointments & Records (Separate batch to avoid 500 limit)
  const batch2 = writeBatch(db);
  
  // Generate some appointments
  for (let i = 0; i < 50; i++) {
    const patientId = faker.helpers.arrayElement(patientIds);
    const doctorId = faker.helpers.arrayElement(doctorIds);
    const deptId = faker.helpers.arrayElement(DEPARTMENTS).id;
    const status = faker.helpers.arrayElement(['completed', 'completed', 'scheduled', 'waiting']);
    
    const aptRef = doc(collection(db, 'appointments'));
    batch2.set(aptRef, {
      patientId,
      doctorId,
      departmentId: deptId,
      dateTime: faker.date.soon({ days: 7 }).toISOString(),
      status,
      symptoms: faker.lorem.sentence(),
      createdAt: Timestamp.now().toDate().toISOString()
    });
  }

  // Generate some records
  for (let i = 0; i < 30; i++) {
    const patientId = faker.helpers.arrayElement(patientIds);
    const doctorId = faker.helpers.arrayElement(doctorIds);
    
    const recRef = doc(collection(db, 'medicalRecords'));
    batch2.set(recRef, {
      patientId,
      doctorId,
      type: faker.helpers.arrayElement(['lab', 'imaging', 'prescription', 'note']),
      title: faker.system.commonFileName('pdf'),
      content: faker.lorem.paragraphs(2),
      date: faker.date.past().toISOString()
    });
  }

  await batch2.commit();
}
