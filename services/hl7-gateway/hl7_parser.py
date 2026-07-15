"""
HL7 v2 Message Parser for AfyaHero

Parses HL7 v2 messages (ADT, ORM, etc.) and converts them to FHIR resources.
Supports hospital system integration via standard HL7 v2 messaging.
"""

import re
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class HL7MessageType(Enum):
    """HL7 v2 message types"""
    ADT_A01 = "ADT^A01"  # Admit patient
    ADT_A02 = "ADT^A02"  # Transfer patient
    ADT_A03 = "ADT^A03"  # Discharge patient
    ADT_A04 = "ADT^A04"  # Register patient
    ADT_A08 = "ADT^A08"  # Update patient information
    ORM_O01 = "ORM^O01"  # Order message
    ORU_R01 = "ORU^R01"  # Unsolicited observation/result message


@dataclass
class HL7Segment:
    """Represents an HL7 segment"""
    segment_id: str
    fields: List[str]
    
    def get_field(self, index: int, subfield: int = 0, component: int = 0) -> Optional[str]:
        """
        Get a field value by index.
        HL7 uses 1-based indexing.
        """
        if index < 1 or index > len(self.fields):
            return None
        
        field = self.fields[index - 1]
        
        # Handle subfields (^)
        if subfield > 0:
            subfields = field.split('^')
            if subfield <= len(subfields):
                field = subfields[subfield - 1]
            else:
                return None
        
        # Handle components (&)
        if component > 0:
            components = field.split('&')
            if component <= len(components):
                field = components[component - 1]
            else:
                return None
        
        # Handle subcomponents (~)
        field = field.replace('~', '^')
        
        return field if field else None


@dataclass
class HL7Message:
    """Represents a complete HL7 message"""
    message_type: HL7MessageType
    segments: List[HL7Segment]
    raw_message: str
    timestamp: datetime
    
    def get_segment(self, segment_id: str) -> Optional[HL7Segment]:
        """Get a segment by ID (e.g., 'PID', 'PV1', 'ORC')"""
        for segment in self.segments:
            if segment.segment_id == segment_id:
                return segment
        return None
    
    def get_segments(self, segment_id: str) -> List[HL7Segment]:
        """Get all segments with a given ID (for repeating segments)"""
        return [s for s in self.segments if s.segment_id == segment_id]


class HL7Parser:
    """Parser for HL7 v2 messages"""
    
    # Field separators
    FIELD_SEPARATOR = '|'
    COMPONENT_SEPARATOR = '^'
    SUBCOMPONENT_SEPARATOR = '&'
    FIELD_REPEAT_SEPARATOR = '~'
    ESCAPE_CHARACTER = '\\'
    
    def __init__(self):
        """Initialize the HL7 parser"""
        self.encoding_chars = None
    
    def parse(self, message: str) -> HL7Message:
        """
        Parse an HL7 v2 message.
        
        Args:
            message: Raw HL7 message string
            
        Returns:
            HL7Message object
            
        Raises:
            ValueError: If message is invalid
        """
        message = message.strip()
        
        if not message.startswith('MSH'):
            raise ValueError("HL7 message must start with MSH segment")
        
        # Parse MSH segment first to get encoding characters
        segments = self._split_segments(message)
        
        if not segments:
            raise ValueError("No segments found in message")
        
        msh_segment = self._parse_segment(segments[0])
        self.encoding_chars = self._extract_encoding_chars(msh_segment)
        
        # Parse all segments
        parsed_segments = [msh_segment]
        for seg in segments[1:]:
            parsed_segments.append(self._parse_segment(seg))
        
        # Determine message type
        message_type = self._determine_message_type(parsed_segments)
        
        return HL7Message(
            message_type=message_type,
            segments=parsed_segments,
            raw_message=message,
            timestamp=datetime.now()
        )
    
    def _split_segments(self, message: str) -> List[str]:
        """Split message into segments"""
        segments = []
        current_segment = ""
        
        for i, char in enumerate(message):
            if char == '\r' or char == '\n':
                if current_segment:
                    segments.append(current_segment)
                    current_segment = ""
            else:
                current_segment += char
        
        if current_segment:
            segments.append(current_segment)
        
        return segments
    
    def _parse_segment(self, segment: str) -> HL7Segment:
        """Parse a single segment"""
        # Extract segment ID (first 3 characters)
        segment_id = segment[:3]
        
        # Extract fields
        if len(segment) > 3:
            fields_str = segment[3:]
            # Use field separator (default to | if not set)
            separator = self.encoding_chars[0] if self.encoding_chars else '|'
            fields = fields_str.split(separator)
        else:
            fields = []
        
        return HL7Segment(segment_id=segment_id, fields=fields)
    
    def _extract_encoding_chars(self, msh_segment: HL7Segment) -> str:
        """
        Extract encoding characters from MSH segment.
        MSH.4 contains encoding characters: |^~\& (default)
        """
        if len(msh_segment.fields) < 4:
            return '|^~\\&'
        
        encoding_chars = msh_segment.fields[3]
        if encoding_chars:
            return encoding_chars
        return '|^~\\&'
    
    def _determine_message_type(self, segments: List[HL7Segment]) -> HL7MessageType:
        """Determine message type from MSH.9 field"""
        msh = segments[0]
        # MSH.9 contains message type (e.g., ADT^A01^ADT_A01)
        msg_type_field = msh.get_field(9)
        
        if msg_type_field:
            parts = msg_type_field.split('^')
            msg_type = f"{parts[0]}^{parts[1]}" if len(parts) > 1 else parts[0]
            
            try:
                return HL7MessageType(msg_type)
            except ValueError:
                logger.warning(f"Unknown message type: {msg_type}")
                return HL7MessageType.ADT_A04  # Default to register patient
        
        return HL7MessageType.ADT_A04


class HL7ToFHIRConverter:
    """Converts HL7 v2 messages to FHIR resources"""
    
    def __init__(self):
        """Initialize the converter"""
        self.parser = HL7Parser()
    
    def convert_to_fhir(self, hl7_message: str) -> Dict[str, Any]:
        """
        Convert an HL7 v2 message to FHIR resources.
        
        Args:
            hl7_message: Raw HL7 message string
            
        Returns:
            Dictionary with FHIR resources
        """
        try:
            message = self.parser.parse(hl7_message)
            
            if message.message_type in [HL7MessageType.ADT_A01, HL7MessageType.ADT_A02, 
                                         HL7MessageType.ADT_A03, HL7MessageType.ADT_A04,
                                         HL7MessageType.ADT_A08]:
                return self._convert_adt(message)
            elif message.message_type == HL7MessageType.ORM_O01:
                return self._convert_orm(message)
            elif message.message_type == HL7MessageType.ORU_R01:
                return self._convert_oru(message)
            else:
                logger.warning(f"Unsupported message type: {message.message_type}")
                return {}
        
        except Exception as e:
            logger.error(f"Failed to convert HL7 message to FHIR: {str(e)}")
            raise
    
    def _convert_adt(self, message: HL7Message) -> Dict[str, Any]:
        """Convert ADT (Admission/Discharge/Transfer) message to FHIR resources"""
        resources = {}
        
        # Extract PID segment (Patient Identification)
        pid = message.get_segment('PID')
        if pid:
            resources['Patient'] = self._convert_pid_to_patient(pid)
        
        # Extract PV1 segment (Patient Visit)
        pv1 = message.get_segment('PV1')
        if pv1:
            encounter = self._convert_pv1_to_encounter(pv1, message.message_type)
            resources['Encounter'] = encounter
            
            # Link patient to encounter
            if 'Patient' in resources:
                resources['Encounter']['subject'] = {
                    'reference': f"Patient/{resources['Patient']['id']}"
                }
        
        # Extract NK1 segment (Next of Kin)
        nk1_segments = message.get_segments('NK1')
        if nk1_segments:
            resources['RelatedPerson'] = [
                self._convert_nk1_to_relatedperson(nk1, resources.get('Patient'))
                for nk1 in nk1_segments
            ]
        
        return resources
    
    def _convert_pid_to_patient(self, pid: HL7Segment) -> Dict[str, Any]:
        """Convert PID segment to FHIR Patient resource"""
        # PID.3: Patient ID (external identifier)
        patient_id = pid.get_field(3, 1) or pid.get_field(2) or f"ext-{datetime.now().timestamp()}"
        
        # PID.5: Patient Name (Family^Given^Middle^Prefix^Suffix^Degree)
        name_field = pid.get_field(5)
        family_name = ""
        given_name = ""
        if name_field:
            name_parts = name_field.split('^')
            family_name = name_parts[0] if len(name_parts) > 0 else ""
            given_name = name_parts[1] if len(name_parts) > 1 else ""
        
        # PID.7: Date of Birth
        dob = pid.get_field(7)
        
        # PID.8: Sex
        sex = pid.get_field(8)
        if sex:
            sex = 'male' if sex == 'M' else 'female' if sex == 'F' else 'other'
        
        # PID.11: Patient Address
        address_field = pid.get_field(11)
        address = None
        if address_field:
            addr_parts = address_field.split('^')
            address = {
                'line': [addr_parts[0]] if len(addr_parts) > 0 else [],
                'city': addr_parts[2] if len(addr_parts) > 2 else None,
                'state': addr_parts[3] if len(addr_parts) > 3 else None,
                'postalCode': addr_parts[4] if len(addr_parts) > 4 else None,
                'country': addr_parts[5] if len(addr_parts) > 5 else None,
            }
        
        # PID.13: Phone Number - Home
        phone_home = pid.get_field(13, 1)
        
        # PID.14: Phone Number - Business
        phone_business = pid.get_field(14, 1)
        
        telecom = []
        if phone_home:
            telecom.append({'system': 'phone', 'value': phone_home, 'use': 'home'})
        if phone_business:
            telecom.append({'system': 'phone', 'value': phone_business, 'use': 'work'})
        
        return {
            'resourceType': 'Patient',
            'id': patient_id,
            'identifier': [
                {
                    'system': 'http://afyahero.com/patient-id',
                    'value': patient_id,
                    'use': 'official'
                }
            ],
            'name': [{
                'family': family_name,
                'given': [given_name] if given_name else []
            }],
            'gender': sex,
            'birthDate': dob if dob else None,
            'address': [address] if address else None,
            'telecom': telecom if telecom else None,
            'active': True
        }
    
    def _convert_pv1_to_encounter(self, pv1: HL7Segment, msg_type: HL7MessageType) -> Dict[str, Any]:
        """Convert PV1 segment to FHIR Encounter resource"""
        # PV1.1: Set ID - PV1
        # PV1.2: Patient Class (Inpatient, Outpatient, Emergency, etc.)
        patient_class = pv1.get_field(2)
        
        # Map HL7 patient class to FHIR encounter class
        class_mapping = {
            'I': 'inpatient',
            'O': 'outpatient',
            'E': 'emergency',
            'P': 'ambulatory',
        }
        encounter_class = class_mapping.get(patient_class, 'outpatient')
        
        # PV1.3: Assigned Patient Location
        location = pv1.get_field(3)
        
        # PV1.7: Attending Doctor
        attending_doctor = pv1.get_field(7, 1)
        
        # PV1.8: Referring Doctor
        referring_doctor = pv1.get_field(8, 1)
        
        # PV1.10: Hospital Service
        hospital_service = pv1.get_field(10)
        
        # Map message type to encounter status
        status_mapping = {
            HL7MessageType.ADT_A01: 'in-progress',  # Admit
            HL7MessageType.ADT_A02: 'in-progress',  # Transfer
            HL7MessageType.ADT_A03: 'finished',     # Discharge
            HL7MessageType.ADT_A04: 'planned',      # Register
            HL7MessageType.ADT_A08: 'in-progress',  # Update
        }
        status = status_mapping.get(msg_type, 'unknown')
        
        participants = []
        if attending_doctor:
            participants.append({
                'individual': {'reference': f"Practitioner/{attending_doctor}"},
                'type': [{'coding': [{'system': 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', 'code': 'ATND'}]}]
            })
        if referring_doctor:
            participants.append({
                'individual': {'reference': f"Practitioner/{referring_doctor}"},
                'type': [{'coding': [{'system': 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', 'code': 'REF'}]}]
            })
        
        return {
            'resourceType': 'Encounter',
            'id': f"enc-{datetime.now().timestamp()}",
            'status': status,
            'class': {
                'system': 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                'code': encounter_class,
                'display': encounter_class.capitalize()
            },
            'type': [{
                'coding': [{
                    'system': 'http://snomed.info/sct',
                    'code': '185349003' if encounter_class == 'outpatient' else '32485007',
                    'display': hospital_service or 'Encounter'
                }]
            }],
            'participant': participants if participants else None,
            'location': [{
                'location': {
                    'display': location or 'Unknown'
                }
            }] if location else None,
            'period': {
                'start': datetime.now().isoformat()
            }
        }
    
    def _convert_nk1_to_relatedperson(self, nk1: HL7Segment, patient: Optional[Dict]) -> Dict[str, Any]:
        """Convert NK1 segment to FHIR RelatedPerson resource"""
        # NK1.2: Name
        name_field = nk1.get_field(2)
        family_name = ""
        given_name = ""
        if name_field:
            name_parts = name_field.split('^')
            family_name = name_parts[0] if len(name_parts) > 0 else ""
            given_name = name_parts[1] if len(name_parts) > 1 else ""
        
        # NK1.3: Relationship
        relationship = nk1.get_field(3)
        
        # NK1.4: Address
        address_field = nk1.get_field(4)
        address = None
        if address_field:
            addr_parts = address_field.split('^')
            address = {
                'line': [addr_parts[0]] if len(addr_parts) > 0 else [],
                'city': addr_parts[2] if len(addr_parts) > 2 else None,
                'state': addr_parts[3] if len(addr_parts) > 3 else None,
                'postalCode': addr_parts[4] if len(addr_parts) > 4 else None,
            }
        
        # NK1.5: Phone Number
        phone = nk1.get_field(5, 1)
        
        telecom = [{'system': 'phone', 'value': phone}] if phone else None
        
        related_person = {
            'resourceType': 'RelatedPerson',
            'id': f"rel-{datetime.now().timestamp()}",
            'name': [{
                'family': family_name,
                'given': [given_name] if given_name else []
            }],
            'telecom': telecom if telecom else None,
            'address': [address] if address else None,
        }
        
        if patient:
            related_person['patient'] = {
                'reference': f"Patient/{patient['id']}"
            }
        
        if relationship:
            related_person['relationship'] = [{
                'coding': [{
                    'system': 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
                    'code': relationship,
                    'display': relationship
                }]
            }]
        
        return related_person
    
    def _convert_orm(self, message: HL7Message) -> Dict[str, Any]:
        """Convert ORM (Order Management) message to FHIR ServiceRequest"""
        resources = {}
        
        # Extract ORC segment (Common Order)
        orc = message.get_segment('ORC')
        if not orc:
            logger.warning("ORM message missing ORC segment")
            return resources
        
        # Extract OBR segment (Observation Request)
        obr = message.get_segment('OBR')
        
        # Extract PID segment (Patient)
        pid = message.get_segment('PID')
        if pid:
            resources['Patient'] = self._convert_pid_to_patient(pid)
        
        # Create ServiceRequest
        service_request = self._convert_orc_obr_to_servicerequest(orc, obr)
        resources['ServiceRequest'] = service_request
        
        # Link patient to service request
        if 'Patient' in resources:
            service_request['subject'] = {
                'reference': f"Patient/{resources['Patient']['id']}"
            }
        
        return resources
    
    def _convert_orc_obr_to_servicerequest(self, orc: HL7Segment, obr: Optional[HL7Segment]) -> Dict[str, Any]:
        """Convert ORC and OBR segments to FHIR ServiceRequest"""
        # ORC.1: Order Control
        order_control = orc.get_field(1)
        
        # ORC.2: Placer Order Number
        placer_order = orc.get_field(2)
        
        # ORC.3: Filler Order Number
        filler_order = orc.get_field(3)
        
        # ORC.5: Order Status
        order_status = orc.get_field(5)
        
        # Map HL7 order status to FHIR status
        status_mapping = {
            'CA': 'cancelled',
            'DC': 'cancelled',
            'IP': 'in-progress',
            'CM': 'completed',
            'SC': 'active',
        }
        status = status_mapping.get(order_status, 'unknown')
        
        # ORC.10: Entered By
        entered_by = orc.get_field(10, 1)
        
        # ORC.12: Ordering Provider
        ordering_provider = orc.get_field(12, 1)
        
        # Extract service code from OBR if available
        service_code = None
        service_display = None
        if obr:
            # OBR.4: Universal Service ID
            service_code = obr.get_field(4, 1)
            service_display = obr.get_field(4, 2)
        
        service_request = {
            'resourceType': 'ServiceRequest',
            'id': placer_order or f"sr-{datetime.now().timestamp()}",
            'status': status,
            'intent': 'order',
            'code': {
                'coding': [{
                    'system': 'http://snomed.info/sct',
                    'code': service_code or 'UNKNOWN',
                    'display': service_display or 'Unknown Service'
                }]
            },
            'authoredOn': datetime.now().isoformat()
        }
        
        if ordering_provider:
            service_request['requester'] = {
                'reference': f"Practitioner/{ordering_provider}"
            }
        
        if entered_by:
            service_request['performer'] = [{
                'reference': f"Practitioner/{entered_by}"
            }]
        
        if filler_order:
            service_request['identifier'] = [{
                'system': 'http://afyahero.com/filler-order',
                'value': filler_order
            }]
        
        return service_request
    
    def _convert_oru(self, message: HL7Message) -> Dict[str, Any]:
        """Convert ORU (Observation Result) message to FHIR DiagnosticReport"""
        resources = {}
        
        # Extract PID segment
        pid = message.get_segment('PID')
        if pid:
            resources['Patient'] = self._convert_pid_to_patient(pid)
        
        # Extract OBR segment
        obr = message.get_segment('OBR')
        if not obr:
            logger.warning("ORU message missing OBR segment")
            return resources
        
        # Extract OBX segments (Observation/Result)
        obx_segments = message.get_segments('OBX')
        
        # Create DiagnosticReport
        diagnostic_report = self._convert_obr_obx_to_diagnosticreport(obr, obx_segments)
        resources['DiagnosticReport'] = diagnostic_report
        
        # Link patient to diagnostic report
        if 'Patient' in resources:
            diagnostic_report['subject'] = {
                'reference': f"Patient/{resources['Patient']['id']}"
            }
        
        return resources
    
    def _convert_obr_obx_to_diagnosticreport(self, obr: HL7Segment, obx_segments: List[HL7Segment]) -> Dict[str, Any]:
        """Convert OBR and OBX segments to FHIR DiagnosticReport"""
        # OBR.4: Universal Service ID
        service_code = obr.get_field(4, 1)
        service_display = obr.get_field(4, 2)
        
        # OBR.7: Observation Date/Time
        obs_date = obr.get_field(7)
        
        # OBR.25: Result Status
        result_status = obr.get_field(25)
        
        # Map HL7 result status to FHIR status
        status_mapping = {
            'F': 'final',
            'P': 'preliminary',
            'X': 'cancelled',
            'I': 'incorrect',
            'D': 'deleted',
        }
        status = status_mapping.get(result_status, 'unknown')
        
        # Convert OBX segments to Observations
        observations = []
        for obx in obx_segments:
            obs = self._convert_obx_to_observation(obx)
            observations.append(obs)
        
        diagnostic_report = {
            'resourceType': 'DiagnosticReport',
            'id': f"dr-{datetime.now().timestamp()}",
            'status': status,
            'code': {
                'coding': [{
                    'system': 'http://loinc.org',
                    'code': service_code or 'UNKNOWN',
                    'display': service_display or 'Unknown Test'
                }]
            },
            'effectiveDateTime': obs_date if obs_date else datetime.now().isoformat(),
            'issued': datetime.now().isoformat(),
            'result': [
                {'reference': f"Observation/{obs['id']}"} for obs in observations
            ]
        }
        
        return diagnostic_report
    
    def _convert_obx_to_observation(self, obx: HL7Segment) -> Dict[str, Any]:
        """Convert OBX segment to FHIR Observation"""
        # OBX.3: Observation Identifier
        obs_code = obx.get_field(3, 1)
        obs_display = obx.get_field(3, 2)
        
        # OBX.5: Observation Value
        obs_value = obx.get_field(5)
        
        # OBX.6: Units
        units = obx.get_field(6)
        
        # OBX.8: Abnormal Flag
        abnormal_flag = obx.get_field(8)
        
        observation = {
            'resourceType': 'Observation',
            'id': f"obs-{datetime.now().timestamp()}",
            'code': {
                'coding': [{
                    'system': 'http://loinc.org',
                    'code': obs_code or 'UNKNOWN',
                    'display': obs_display or 'Unknown Observation'
                }]
            },
            'valueQuantity': {
                'value': float(obs_value) if obs_value and obs_value.replace('.', '').isdigit() else None,
                'unit': units
            } if units else None,
            'interpretation': [{
                'coding': [{
                    'system': 'http://terminology.hl7.org/CodeSystem/v2-0078',
                    'code': abnormal_flag
                }]
            }] if abnormal_flag else None,
            'status': 'final'
        }
        
        return observation


# Convenience function for parsing HL7 messages
def parse_hl7_message(message: str) -> HL7Message:
    """
    Parse an HL7 v2 message.
    
    Args:
        message: Raw HL7 message string
        
    Returns:
        HL7Message object
    """
    parser = HL7Parser()
    return parser.parse(message)


# Convenience function for converting HL7 to FHIR
def convert_hl7_to_fhir(message: str) -> Dict[str, Any]:
    """
    Convert an HL7 v2 message to FHIR resources.
    
    Args:
        message: Raw HL7 message string
        
    Returns:
        Dictionary with FHIR resources
    """
    converter = HL7ToFHIRConverter()
    return converter.convert_to_fhir(message)


if __name__ == "__main__":
    # Test with sample HL7 message
    sample_adt = """MSH|^~\\&|AFYAHERO|FACILITY|AFYAHERO|20260417120000||ADT^A01|123456|P|2.5
EVN|A01|20260417120000||
PID|1||12345^^^AFYAHERO^MR||DOE^JOHN^A||19750101|M||123 MAIN ST^^ANYTOWN^CA^90210^USA||(555)555-1234||(555)555-5678||M||123456789|987654321
NK1|1|DOE^JANE^A|SPOUSE||123 MAIN ST^^ANYTOWN^CA^90210^USA||(555)555-9999
PV1|1|I|ICU^101^1^^^HOSPITAL||||123456^DOE^JOHN^A^^DR||||||||ADM|A0"""
    
    try:
        fhir_resources = convert_hl7_to_fhir(sample_adt)
        print("FHIR Resources:")
        import json
        print(json.dumps(fhir_resources, indent=2))
    except Exception as e:
        print(f"Error: {e}")
