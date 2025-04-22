import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode.react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { 
  Copy, 
  Check, 
  X, 
  Plus, 
  Trash, 
  Download, 
  Loader2, 
  AlertTriangle,
  Tv2,
  Settings,
  Share2,
  Eye,
  EyeOff
} from "lucide-react";
import { 
  createSession, 
  getSession, 
  endSession, 
  updateSession,
  updateSessionParticipant,
  getSessionFinalAction,
  deleteSessionFinalAction
} from '@/utils/sessionUtils';
import { generateRandomId } from '@/utils/utils';
import ParticipantGrid from "@/components/live/ParticipantGrid";
import LivePreview from "@/components/live/LivePreview";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { CirclePicker } from 'react-color';
import { useTheme } from "@/components/ui/use-theme"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { requestParticipantStream } from '@/utils/participantStreamUtils';

interface Participant {
  id: string;
  name: string;
  active: boolean;
  selected: boolean;
  hasVideo?: boolean;
  connectedAt?: number;
}

const LivePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [sessionName, setSessionName] = useState<string>('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnding, setIsEnding] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrCodeVisible, setQrCodeVisible] = useState(true);
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null);
  const [qrCodePosition, setQrCodePosition] = useState({ x: 20, y: 20, width: 120, height: 120 });
  const [qrDescriptionPosition, setQrDescriptionPosition] = useState({ x: 20, y: 160, width: 120, height: 40 });
  const [qrCodeDescription, setQrCodeDescription] = useState('Acesse com o QR Code');
  const [selectedFont, setSelectedFont] = useState('Arial');
  const [selectedTextColor, setSelectedTextColor] = useState('#ffffff');
  const [qrDescriptionFontSize, setQrDescriptionFontSize] = useState(14);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [selectedBackgroundColor, setSelectedBackgroundColor] = useState('#000000');
  const [participantStreams, setParticipantStreams] = useState<{[id: string]: MediaStream}>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isLivePreviewVisible, setIsLivePreviewVisible] = useState(true);
  const [finalAction, setFinalAction] = useState<{
    type: 'none' | 'image' | 'coupon';
    image?: string;
    link?: string;
    coupon?: string;
  }>({ type: 'none' });
  const [isFinalActionModalOpen, setIsFinalActionModalOpen] = useState(false);
  const [finalActionType, setFinalActionType] = useState<'none' | 'image' | 'coupon'>('none');
  const [finalActionImage, setFinalActionImage] = useState<string>('');
  const [finalActionLink, setFinalActionLink] = useState<string>('');
  const [finalActionCoupon, setFinalActionCoupon] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isBackgroundUploadModalOpen, setIsBackgroundUploadModalOpen] = useState(false);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(4);
  const [isQrCodeVisible, setIsQrCodeVisible] = useState(true);
  const [isQrDescriptionVisible, setIsQrDescriptionVisible] = useState(true);
  const [isLiveIndicatorVisible, setIsLiveIndicatorVisible] = useState(true);
  const [isParticipantCountVisible, setIsParticipantCountVisible] = useState(true);
  const [isParticipantListVisible, setIsParticipantListVisible] = useState(true);
  const [isParticipantSettingsVisible, setIsParticipantSettingsVisible] = useState(false);
  const [isParticipantNameVisible, setIsParticipantNameVisible] = useState(true);
  const [isParticipantStatusVisible, setIsParticipantStatusVisible] = useState(true);
  const [isParticipantActionsVisible, setIsParticipantActionsVisible] = useState(true);
  const [isParticipantVideoVisible, setIsParticipantVideoVisible] = useState(true);
  const [isParticipantAudioVisible, setIsParticipantAudioVisible] = useState(true);
  const [isParticipantShareVisible, setIsParticipantShareVisible] = useState(true);
  const [isParticipantRemoveVisible, setIsParticipantRemoveVisible] = useState(true);
  const [isParticipantMuteVisible, setIsParticipantMuteVisible] = useState(true);
  const [isParticipantDeafenVisible, setIsParticipantDeafenVisible] = useState(true);
  const [isParticipantKickVisible, setIsParticipantKickVisible] = useState(true);
  const [isParticipantBanVisible, setIsParticipantBanVisible] = useState(true);
  const [isParticipantPromoteVisible, setIsParticipantPromoteVisible] = useState(true);
  const [isParticipantDemoteVisible, setIsParticipantDemoteVisible] = useState(true);
  const [isParticipantGrantControlVisible, setIsParticipantGrantControlVisible] = useState(true);
  const [isParticipantRevokeControlVisible, setIsParticipantRevokeControlVisible] = useState(true);
  const [isParticipantGrantAccessVisible, setIsParticipantGrantAccessVisible] = useState(true);
  const [isParticipantRevokeAccessVisible, setIsParticipantRevokeAccessVisible] = useState(true);
  const [isParticipantGrantAdminVisible, setIsParticipantGrantAdminVisible] = useState(true);
  const [isParticipantRevokeAdminVisible, setIsParticipantRevokeAdminVisible] = useState(true);
  const [isParticipantGrantOwnerVisible, setIsParticipantGrantOwnerVisible] = useState(true);
  const [isParticipantRevokeOwnerVisible, setIsParticipantRevokeOwnerVisible] = useState(true);
  const [isParticipantGrantModeratorVisible, setIsParticipantGrantModeratorVisible] = useState(true);
  const [isParticipantRevokeModeratorVisible, setIsParticipantRevokeModeratorVisible] = useState(true);
  const [isParticipantGrantEditorVisible, setIsParticipantGrantEditorVisible] = useState(true);
  const [isParticipantRevokeEditorVisible, setIsParticipantRevokeEditorVisible] = useState(true);
  const [isParticipantGrantViewerVisible, setIsParticipantGrantViewerVisible] = useState(true);
  const [isParticipantRevokeViewerVisible] = useState(true);
  const [isParticipantGrantContributorVisible] = useState(true);
  const [isParticipantRevokeContributorVisible] = useState(true);
  const [isParticipantGrantCommenterVisible] = useState(true);
  const [isParticipantRevokeCommenterVisible] = useState(true);
  const [isParticipantGrantFollowerVisible] = useState(true);
  const [isParticipantRevokeFollowerVisible] = useState(true);
  const [isParticipantGrantSubscriberVisible] = useState(true);
  const [isParticipantRevokeSubscriberVisible] = useState(true);
  const [isParticipantGrantMemberVisible] = useState(true);
  const [isParticipantRevokeMemberVisible] = useState(true);
  const [isParticipantGrantSupporterVisible] = useState(true);
  const [isParticipantRevokeSupporterVisible] = useState(true);
  const [isParticipantGrantPatronVisible] = useState(true);
  const [isParticipantRevokePatronVisible] = useState(true);
  const [isParticipantGrantSponsorVisible] = useState(true);
  const [isParticipantRevokeSponsorVisible] = useState(true);
  const [isParticipantGrantPartnerVisible] = useState(true);
  const [isParticipantRevokePartnerVisible] = useState(true);
  const [isParticipantGrantEmployeeVisible] = useState(true);
  const [isParticipantRevokeEmployeeVisible] = useState(true);
  const [isParticipantGrantContractorVisible] = useState(true);
  const [isParticipantRevokeContractorVisible] = useState(true);
  const [isParticipantGrantVolunteerVisible] = useState(true);
  const [isParticipantRevokeVolunteerVisible] = useState(true);
  const [isParticipantInternVisible] = useState(true);
  const [isParticipantTraineeVisible] = useState(true);
  const [isParticipantApprenticeVisible] = useState(true);
  const [isParticipantStudentVisible] = useState(true);
  const [isParticipantTeacherVisible] = useState(true);
  const [isParticipantProfessorVisible] = useState(true);
  const [isParticipantAlumniVisible] = useState(true);
  const [isParticipantGuestVisible] = useState(true);
  const [isParticipantVisitorVisible] = useState(true);
  const [isParticipantUserVisible] = useState(true);
  const [isParticipantMemberVisible] = useState(true);
  const [isParticipantSubscriberVisible] = useState(true);
  const [isParticipantFollowerVisible] = useState(true);
  const [isParticipantCommenterVisible] = useState(true);
  const [isParticipantContributorVisible] = useState(true);
  const [isParticipantEditorVisible] = useState(true);
  const [isParticipantModeratorVisible] = useState(true);
  const [isParticipantAdminVisible] = useState(true);
  const [isParticipantOwnerVisible] = useState(true);
  const [isParticipantSponsorVisible] = useState(true);
  const [isParticipantPartnerVisible] = useState(true);
  const [isParticipantEmployeeVisible] = useState(true);
  const [isParticipantContractorVisible] = useState(true);
  const [isParticipantVolunteerVisible] = useState(true);
  const [isParticipantInternVisible] = useState(true);
  const [isParticipantTraineeVisible] = useState(true);
  const [isParticipantApprenticeVisible] = useState(true);
  const [isParticipantStudentVisible] = useState(true);
  const [isParticipantTeacherVisible] = useState(true);
  const [isParticipantProfessorVisible] = useState(true);
  const [isParticipantAlumniVisible] = useState(true);
  const [isParticipantGuestVisible] = useState(true);
  const [isParticipantVisitorVisible] = useState(true);
  const [isParticipantUserVisible] = useState(true);
  const [isParticipantMemberVisible] = useState(true);
  const [isParticipantSubscriberVisible] = useState(true);
  const [isParticipantFollowerVisible] = useState(true);
  const [isParticipantCommenterVisible] = useState(true);
  const [isParticipantContributorVisible] = useState(true);
  const [isParticipantEditorVisible] = useState(true);
  const [isParticipantModeratorVisible] = useState(true);
  const [isParticipantAdminVisible] = useState(true);
  const [isParticipantOwnerVisible] = useState(true);
  const [isParticipantSponsorVisible] = useState(true);
  const [isParticipantPartnerVisible] = useState(true);
  const [isParticipantEmployeeVisible] = useState(true);
  const [isParticipantContractorVisible] = useState(true);
  const [isParticipantVolunteerVisible] = useState(true);
  const [isParticipantInternVisible] = useState(true);
  const [isParticipantTraineeVisible] = useState(true);
  const [isParticipantApprenticeVisible] = useState(true);
  const [isParticipantStudentVisible] = useState(true);
  const [isParticipantTeacherVisible] = useState(true);
  const [isParticipantProfessorVisible] = useState(true);
  const [isParticipantAlumniVisible] = useState(true);
  const [isParticipantGuestVisible] = useState(true);
  const [isParticipantVisitorVisible] = useState(true);
  const [isParticipantUserVisible] = useState(true);
  const [isParticipantMemberVisible] = useState(true);
  const [isParticipantSubscriberVisible] = useState(true);
  const [isParticipantFollowerVisible] = useState(true);
  const [isParticipantCommenterVisible] = useState(true);
  const [isParticipantContributorVisible] = useState(true);
  const [isParticipantEditorVisible] = useState(true);
  const [isParticipantModeratorVisible] = useState(true);
  const [isParticipantAdminVisible] = useState(true);
  const [isParticipantOwnerVisible] = useState(true);
  const [isParticipantSponsorVisible] = useState(true);
  const [isParticipantPartnerVisible] = useState(true);
  const [isParticipantEmployeeVisible] = useState(true);
  const [isParticipantContractorVisible] = useState(true);
  const [isParticipantVolunteerVisible] = useState(true);
  const [isParticipantInternVisible] = useState(true);
  const [isParticipantTraineeVisible] = useState(true);
  const [isParticipantApprenticeVisible] = useState(true);
  const [isParticipantStudentVisible] = useState(true);
  const [isParticipantTeacherVisible] = useState(true);
  const [isParticipantProfessorVisible] = useState(true);
  const [isParticipantAlumniVisible] = useState(true);
  const [isParticipantGuestVisible] = useState(true);
  const [isParticipantVisitorVisible] = useState(true);
  const [isParticipantUserVisible] = useState(true);
  const [isParticipantMemberVisible] = useState(true);
  const [isParticipantSubscriberVisible] = useState(true);
  const [isParticipantFollowerVisible] = useState(true);
  const [isParticipantCommenterVisible] = useState(true);
  const [isParticipantContributorVisible] = useState(true);
  const [isParticipantEditorVisible] = useState(true);
  const [isParticipantModeratorVisible] = useState(true);
  const [isParticipantAdminVisible] = useState(true);
  const [isParticipantOwnerVisible] = useState(true);
  const [isParticipantSponsorVisible] = useState(true);
  const [isParticipantPartnerVisible] = useState(true);
  const [isParticipantEmployeeVisible] = useState(true);
  const [isParticipantContractorVisible] = useState(true);
  const [isParticipantVolunteerVisible] = useState(true);
  const [isParticipantInternVisible] = useState(true);
  const [isParticipantTraineeVisible] = useState(true);
  const [isParticipantApprenticeVisible] = useState(true);
  const [isParticipantStudentVisible] = useState(true);
  const [isParticipantTeacherVisible] = useState(true);
  const [isParticipantProfessorVisible] = useState(true);
  const [isParticipantAlumniVisible] = useState(true);
  const [isParticipantGuestVisible] = useState(true);
  const [isParticipantVisitorVisible] = useState(true);
  const [isParticipantUserVisible] = useState(true);
  const [isParticipantMemberVisible] = useState(true);
  const [isParticipantSubscriberVisible] = useState(true);
  const [isParticipantFollowerVisible] = useState(true);
  const [isParticipantCommenterVisible] = useState(true);
  const [isParticipantContributorVisible] = useState(true);
  const [isParticipantEditorVisible] = useState(true);
  const [isParticipantModeratorVisible] = useState(true);
  const [isParticipantAdminVisible] = useState(true);
  const [isParticipantOwnerVisible] = useState(true);
  const [isParticipantSponsorVisible] = useState(true);
  const [isParticipantPartnerVisible] = useState(true);
  const [isParticipantEmployeeVisible] = useState(true);
  const [isParticipantContractorVisible] = useState(true);
  const [isParticipantVolunteerVisible] = useState(true);
  const [isParticipantInternVisible] = useState(true);
  const [isParticipantTraineeVisible] = useState(true);
  const [isParticipantApprenticeVisible] = useState(true);
  const [isParticipantStudentVisible] = useState(true);
  const [isParticipantTeacherVisible] = useState(true);
  const [isParticipantProfessorVisible] = useState(true);
  const [isParticipantAlumniVisible] = useState(true);
  const [isParticipantGuestVisible] = useState(true);
  const [isParticipantVisitorVisible] = useState(true);
  const [isParticipantUserVisible] = useState(true);
  const [
    isParticipantRevokeVisitorVisible
  ] = useState(true);
  const [isParticipantGrantUserVisible] = useState(true);
  const [isParticipantRevokeUserVisible] = useState(true);
  const [isParticipantGrantMemberVisible] = useState(true);
  const [isParticipantRevokeMemberVisible] = useState(true);
  const [isParticipantSubscriberVisible] = useState(true);
  const [isParticipantRevokeSubscriberVisible] = useState(true);
  const [isParticipantFollowerVisible] = useState(true);
  const [isParticipantRevokeFollowerVisible] = useState(true);
  const [isParticipantCommenterVisible] = useState(true);
  const [isParticipantRevokeCommenterVisible] = useState(true);
  const [isParticipantContributorVisible] = useState(true);
  const [isParticipantRevokeContributorVisible] = useState(true);
  const [isParticipantEditorVisible] = useState(true);
  const [isParticipantRevokeEditorVisible] = useState(true);
  const [isParticipantModeratorVisible] = useState(true);
  const [isParticipantRevokeModeratorVisible] = useState(true);
  const [isParticipantAdminVisible] = useState(true);
  const [isParticipantRevokeAdminVisible] = useState(true);
  const [isParticipantOwnerVisible] = useState(true);
  const [isParticipantRevokeOwnerVisible] = useState(true);

  useEffect(() => {
    const storedSessionId = localStorage.getItem('sessionId');

    if (storedSessionId) {
      setSessionId(storedSessionId);
      fetchSessionData(storedSessionId);
    } else {
      startNewSession();
    }
  }, []);

  
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('sessionId', sessionId);
      setQrCode(`${window.location.origin}/join/${sessionId}`);
    }
  }, [sessionId]);

  useEffect(() => {
    if (qrCode) {
      generateQrCode(qrCode);
    }
  }, [qrCode]);

  useEffect(() => {
    if (session) {
      setSessionName(session.name || '');
      setParticipants(session.participants || []);
      setBackgroundImage(session.backgroundImage || null);
      setSelectedBackgroundColor(session.backgroundColor || '#000000');
      setQrCodePosition(session.qrCodePosition || { x: 20, y: 20, width: 120, height: 120 });
      setQrDescriptionPosition(session.qrDescriptionPosition || { x: 20, y: 160, width: 120, height: 40 });
      setQrCodeDescription(session.qrCodeDescription || 'Acesse com o QR Code');
      setSelectedFont(session.font || 'Arial');
      setSelectedTextColor(session.textColor || '#ffffff');
      setQrDescriptionFontSize(session.fontSize || 14);
      setIsQrCodeVisible(session.isQrCodeVisible !== undefined ? session.isQrCodeVisible : true);
      setIsQrDescriptionVisible(session.isQrDescriptionVisible !== undefined ? session.isQrDescriptionVisible : true);
      setIsLiveIndicatorVisible(session.isLiveIndicatorVisible !== undefined ? session.isLiveIndicatorVisible : true);
      setIsParticipantCountVisible(session.isParticipantCountVisible !== undefined ? session.isParticipantCountVisible : true);
      setIsParticipantListVisible(session.isParticipantListVisible !== undefined ? session.isParticipantListVisible : true);
      setIsParticipantSettingsVisible(session.isParticipantSettingsVisible !== undefined ? session.isParticipantSettingsVisible : false);
      setIsParticipantNameVisible(session.isParticipantNameVisible !== undefined ? session.isParticipantNameVisible : true);
      setIsParticipantStatusVisible(session.isParticipantStatusVisible !== undefined ? session.isParticipantStatusVisible : true);
      setIsParticipantActionsVisible(session.isParticipantActionsVisible !== undefined ? session.isParticipantActionsVisible : true);
      setIsParticipantVideoVisible(session.isParticipantVideoVisible !== undefined ? session.isParticipantVideoVisible : true);
      setIsParticipantAudioVisible(session.isParticipantAudioVisible !== undefined ? session.isParticipantAudioVisible : true);
      setIsParticipantShareVisible(session.isParticipantShareVisible !== undefined ? session.isParticipantShareVisible : true);
      setIsParticipantRemoveVisible(session.isParticipantRemoveVisible !== undefined ? session.isParticipantRemoveVisible : true);
      setIsParticipantMuteVisible(session.isParticipantMuteVisible !== undefined ? session.isParticipantMuteVisible : true);
      setIsParticipantDeafenVisible(session.isParticipantDeafenVisible !== undefined ? session.isParticipantDeafenVisible : true);
      setIsParticipantKickVisible(session.isParticipantKickVisible !== undefined ? session.isParticipantKickVisible : true);
      setIsParticipantBanVisible(session.isParticipantBanVisible !== undefined ? session.isParticipantBanVisible : true);
      setIsParticipantPromoteVisible(session.isParticipantPromoteVisible !== undefined ? session.isParticipantPromoteVisible : true);
      setIsParticipantDemoteVisible(session.isParticipantDemoteVisible !== undefined ? session.isParticipantDemoteVisible : true);
      setIsParticipantGrantControlVisible(session.isParticipantGrantControlVisible !== undefined ? session.isParticipantGrantControlVisible : true);
      setIsParticipantRevokeControlVisible(session.isParticipantRevokeControlVisible !== undefined ? session.isParticipantRevokeControlVisible : true);
      setIsParticipantGrantAccessVisible(session.isParticipantGrantAccessVisible !== undefined ? session.isParticipantGrantAccessVisible : true);
      setIsParticipantRevokeAccessVisible(session.isParticipantRevokeAccessVisible !== undefined ? session.isParticipantRevokeAccessVisible : true);
      setIsParticipantGrantAdminVisible(session.isParticipantGrantAdminVisible !== undefined ? session.isParticipantGrantAdminVisible : true);
      setIsParticipantRevokeAdminVisible(session.isParticipantRevokeAdminVisible !== undefined ? session.isParticipantRevokeAdminVisible : true);
      setIsParticipantGrantOwnerVisible(session.isParticipantGrantOwnerVisible !== undefined ? session.isParticipantGrantOwnerVisible : true);
      setIsParticipantRevokeOwnerVisible(session.isParticipantRevokeOwnerVisible !== undefined ? session.isParticipantRevokeOwnerVisible : true);
      setIsParticipantGrantModeratorVisible(session.isParticipantGrantModeratorVisible !== undefined ? session.isParticipantGrantModeratorVisible : true);
      setIsParticipantRevokeModeratorVisible(session.isParticipantRevokeModeratorVisible !== undefined ? session.isParticipantRevokeModeratorVisible : true);
      setIsParticipantGrantEditorVisible(session.isParticipantGrantEditorVisible !== undefined ? session.isParticipantGrantEditorVisible : true);
      setIsParticipantRevokeEditorVisible(session.isParticipantRevokeEditorVisible !== undefined ? session.isParticipantRevokeEditorVisible : true);
      
      setIsParticipantGrantViewerVisible(session.isParticipantGrantViewerVisible !== undefined ? session.isParticipantGrantViewerVisible : true);
      setIsParticipantRevokeViewerVisible(session.isParticipantRevokeViewerVisible !== undefined ? session.isParticipantRevokeViewerVisible : true);
      setIsParticipantGrantContributorVisible(session.isParticipantGrantContributorVisible !== undefined ? session.isParticipantGrantContributorVisible : true);
      setIsParticipantRevokeContributorVisible(session.isParticipantRevokeContributorVisible !== undefined ? session.isParticipantRevokeContributorVisible : true);
      setIsParticipantGrantCommenterVisible(session.isParticipantGrantCommenterVisible !== undefined ? session.isParticipantGrantCommenterVisible : true);
      setIsParticipantRevokeCommenterVisible(session.isParticipantRevokeCommenterVisible !== undefined ? session.isParticipantRevokeCommenterVisible : true);
      setIsParticipantGrantFollowerVisible(session.isParticipantGrantFollowerVisible !== undefined ? session.isParticipantGrantFollowerVisible : true);
      setIsParticipantRevokeFollowerVisible(session.isParticipantRevokeFollowerVisible !== undefined ? session.isParticipantRevokeFollowerVisible : true);
      setIsParticipantGrantSubscriberVisible(session.isParticipantGrantSubscriberVisible !== undefined ? session.isParticipantGrantSubscriberVisible : true);
      setIsParticipantRevokeSubscriberVisible(session.isParticipantRevokeSubscriberVisible !== undefined ? session.isParticipantRevokeSubscriberVisible : true);
      setIsParticipantGrantMemberVisible(session.isParticipantGrantMemberVisible !== undefined ? session.isParticipantGrantMemberVisible : true);
      setIsParticipantRevokeMemberVisible(session.isParticipantRevokeMemberVisible !== undefined ? session.isParticipantRevokeMemberVisible : true);
      setIsParticipantGrantSupporterVisible(session.isParticipantGrantSupporterVisible !== undefined ? session.isParticipantGrantSupporterVisible : true);
      setIsParticipantRevokeSupporterVisible(session.isParticipantRevokeSupporterVisible !== undefined ? session.isParticipantRevokeSupporterVisible : true);
      setIsParticipantGrantPatronVisible(session.isParticipantGrantPatronVisible !== undefined ? session.isParticipantGrantPatronVisible : true);
      setIsParticipantRevokePatronVisible(session.isParticipantRevokePatronVisible !== undefined ? session.isParticipantRevokePatronVisible : true);
      setIsParticipantGrantSponsorVisible(session.isParticipantGrantSponsorVisible !== undefined ? session.isParticipantGrantSponsorVisible : true);
      setIsParticipantRevokeSponsorVisible(session.isParticipantRevokeSponsorVisible !== undefined ? session.isParticipantRevokeSponsorVisible : true);
      setIsParticipantGrantPartnerVisible(session.isParticipantGrantPartnerVisible !== undefined ? session.isParticipantGrantPartnerVisible : true);
      setIsParticipantRevokePartnerVisible(session.isParticipantRevokePartnerVisible !== undefined ? session.isParticipantRevokePartnerVisible : true);
      setIsParticipantGrantEmployeeVisible(session.isParticipantGrantEmployeeVisible !== undefined ? session.isParticipantGrantEmployeeVisible : true);
      setIsParticipantRevokeEmployeeVisible(session.isParticipantRevokeEmployeeVisible !== undefined ? session.isParticipantRevokeEmployeeVisible : true);
      setIsParticipantGrantContractorVisible(session.isParticipantGrantContractorVisible !== undefined ? session.isParticipantGrantContractorVisible : true);
      setIsParticipantRevokeContractorVisible(session.isParticipantRevokeContractorVisible !== undefined ? session.isParticipantRevokeContractorVisible : true);
      setIsParticipantGrantVolunteerVisible(session.isParticipantGrantVolunteerVisible !== undefined ? session.isParticipantGrantVolunteerVisible : true);
      setIsParticipantRevokeVolunteerVisible(session.isParticipantRevokeVolunteerVisible !== undefined ? session.isParticipantRevokeVolunteerVisible : true);
      setIsParticipantGrantInternVisible(session.isParticipantGrantInternVisible !== undefined ? session.isParticipantGrantInternVisible : true);
      setIsParticipantRevokeInternVisible(session.isParticipantRevokeInternVisible !== undefined ? session.isParticipantRevokeInternVisible : true);
      setIsParticipantGrantTraineeVisible(session.isParticipantGrantTraineeVisible !== undefined ? session.isParticipantGrantTraineeVisible : true);
      setIsParticipantRevokeTraineeVisible(session.isParticipantRevokeTraineeVisible !== undefined ? session.isParticipantRevokeTraineeVisible : true);
      setIsParticipantGrantApprenticeVisible(session.isParticipantGrantApprenticeVisible !== undefined ? session.isParticipantGrantApprenticeVisible : true);
      setIsParticipantRevokeApprenticeVisible(session.isParticipantRevokeApprenticeVisible !== undefined ? session.isParticipantRevokeApprenticeVisible : true);
      setIsParticipantGrantStudentVisible(session.isParticipantGrantStudentVisible !== undefined ? session.isParticipantGrantStudentVisible : true);
      setIsParticipantRevokeStudentVisible(session.isParticipantRevokeStudentVisible !== undefined ? session.isParticipantRevokeStudentVisible : true);
      setIsParticipantGrantTeacherVisible(session.isParticipantTeacherVisible !== undefined ? session.isParticipantTeacherVisible : true);
      setIsParticipantRevokeTeacherVisible(session.isParticipantRevokeTeacherVisible !== undefined ? session.isParticipantRevokeTeacherVisible : true);
      setIsParticipantGrantProfessorVisible(session.isParticipantProfessorVisible !== undefined ? session.isParticipantProfessorVisible : true);
      setIsParticipantRevokeProfessorVisible(session.isParticipantRevokeProfessorVisible !== undefined ? session.isParticipantRevokeProfessorVisible : true);
      setIsParticipantGrantAlumniVisible(session.isParticipantAlumniVisible !== undefined ? session.isParticipantAlumniVisible : true);
      setIsParticipantRevokeAlumniVisible(session.isParticipantRevokeAlumniVisible !== undefined ? session.isParticipantRevokeAlumniVisible : true);
      setIsParticipantGuestVisible(session.isParticipantGuestVisible !== undefined ? session.isParticipantGuestVisible : true);
      setIsParticipantVisitorVisible(session.isParticipantVisitorVisible !== undefined ? session.isParticipantVisitorVisible : true);
      setIsParticipantUserVisible(session.isParticipantUserVisible !== undefined ? session.isParticipantUserVisible : true);
      setIsParticipantMemberVisible(session.isParticipantMemberVisible !== undefined ? session.isParticipantMemberVisible : true);
      setIsParticipantSubscriberVisible(session.isParticipantSubscriberVisible !== undefined ? session.isParticipantSubscriberVisible : true);
      setIsParticipantFollowerVisible(session.isParticipantFollowerVisible !== undefined ? session.isParticipantFollowerVisible : true);
      setIsParticipantCommenterVisible(session.isParticipantCommenterVisible !== undefined ? session.isParticipantCommenterVisible : true);
      setIsParticipantContributorVisible(session.isParticipantContributorVisible !== undefined ? session.isParticipantContributorVisible : true);
      setIsParticipantEditorVisible(session.isParticipantEditorVisible !== undefined ? session.isParticipantEditorVisible : true);
      setIsParticipantModeratorVisible(session.isParticipantModeratorVisible !== undefined ? session.isParticipantModeratorVisible : true);
      setIsParticipantAdminVisible(session.isParticipantAdminVisible !== undefined ? session.isParticipantAdminVisible : true);
      setIsParticipantOwnerVisible(session.isParticipantOwnerVisible !== undefined ? session.isParticipantOwnerVisible : true);
      setIsParticipantSponsorVisible(session.isParticipantSponsorVisible !== undefined ? session.isParticipantSponsorVisible : true);
      setIsParticipantPartnerVisible(session.isParticipantPartnerVisible !== undefined ? session.isParticipantPartnerVisible : true);
      setIsParticipantEmployeeVisible(session.isParticipantEmployeeVisible !== undefined ? session.isParticipantEmployeeVisible : true);
      setIsParticipantContractorVisible(session.isParticipantContractorVisible !== undefined ? session.isParticipantContractorVisible : true);
      setIsParticipantVolunteerVisible(session.isParticipantVolunteerVisible !== undefined ? session.isParticipantVolunteerVisible : true);
      setIsParticipantInternVisible(session.isParticipantInternVisible !== undefined ? session.isParticipantInternVisible : true);
      setIsParticipantTraineeVisible(session.isParticipantTraineeVisible !== undefined ? session.isParticipantTraineeVisible : true);
      setIsParticipantApprenticeVisible(session.isParticipantApprenticeVisible !== undefined ? session.isParticipantApprenticeVisible : true);
      setIsParticipantStudentVisible(session.isParticipantStudentVisible !== undefined ? session.isParticipantStudentVisible : true);
      setIsParticipantTeacherVisible(session.isParticipantTeacherVisible !== undefined ? session.isParticipantTeacherVisible : true);
      setIsParticipantProfessorVisible(session.isParticipantProfessorVisible !== undefined ? session.isParticipantProfessorVisible : true);
      setIsParticipantAlumniVisible(session.isParticipantAlumniVisible !== undefined ? session.isParticipantAlumniVisible : true);
      setIsParticipantGuestVisible(session.isParticipantGuestVisible !== undefined ? session.isParticipantGuestVisible : true);
      setIsParticipantVisitorVisible(session.isParticipantVisitorVisible !== undefined ? session.isParticipantVisitorVisible : true);
      setIsParticipantUserVisible(session.isParticipantUserVisible !== undefined ? session.isParticipantUserVisible : true);
      setIsParticipantMemberVisible(session.isParticipantMemberVisible !== undefined ? session.isParticipantMemberVisible : true);
      setIsParticipantSubscriberVisible(session.isParticipantSubscriberVisible !== undefined ? session.isParticipantSubscriberVisible : true);
      setIsParticipantFollowerVisible(session.isParticipantFollowerVisible !== undefined ? session.isParticipantFollowerVisible : true);
      setIsParticipantCommenterVisible(session.isParticipantCommenterVisible !== undefined ? session.isParticipantCommenterVisible : true);
      setIsParticipantContributorVisible(session.isParticipantContributorVisible !== undefined ? session.isParticipantContributorVisible : true);
      setIsParticipantEditorVisible(session.isParticipantEditorVisible !== undefined ? session.isParticipantEditorVisible : true);
      setIsParticipantModeratorVisible(session.isParticipantModeratorVisible !== undefined ? session.isParticipantModeratorVisible : true);
      setIsParticipantAdminVisible(session.isParticipantAdminVisible !== undefined ? session.isParticipantAdminVisible : true);
      setIsParticipantOwnerVisible(session.isParticipantOwnerVisible !== undefined ? session.isParticipantOwnerVisible : true);
      setIsParticipantSponsorVisible(session.isParticipantSponsorVisible !== undefined ? session.isParticipantSponsorVisible : true);
      setIsParticipantPartnerVisible(session.isParticipantPartnerVisible !== undefined ? session.isParticipantPartnerVisible : true);
      setIsParticipantEmployeeVisible(session.isParticipantEmployeeVisible !== undefined ? session.isParticipantEmployeeVisible : true);
      setIsParticipantContractorVisible(session.isParticipantContractorVisible !== undefined ? session.isParticipantContractorVisible : true);
      setIsParticipantVolunteerVisible(session.isParticipantVolunteerVisible !== undefined ? session.isParticipantVolunteerVisible : true);
      setIsParticipantInternVisible(session.isParticipantInternVisible !== undefined ? session.isParticipantInternVisible : true);
      setIsParticipantTraineeVisible(session.isParticipantTraineeVisible !== undefined ? session.isParticipantTraineeVisible : true);
      setIsParticipantApprenticeVisible(session.isParticipantApprenticeVisible !== undefined ? session.isParticipantApprenticeVisible : true);
      setIsParticipantStudentVisible(session.isParticipantStudentVisible !== undefined ? session.isParticipantStudentVisible : true);
      setIsParticipantTeacherVisible(session.isParticipantTeacherVisible !== undefined ? session.isParticipantTeacherVisible : true);
      setIsParticipantProfessorVisible(session.isParticipantProfessorVisible !== undefined ? session.isParticipantProfessorVisible : true);
      setIsParticipantAlumniVisible(session.isParticipantAlumniVisible !== undefined ?
