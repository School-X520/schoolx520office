INSERT INTO public.rooms (id, name, type, icon, description, default_model, display_order, layout_x, layout_y, is_active)
VALUES
('meeting','메인 회의방','meeting','🏛️','모든 팀원이 모이고 각 방의 봇이 잠시 입장하는 협업 허브입니다.','claude-sonnet-4-5',0,2,2,true),
('finance','재무','department','💰','예산, 정산, 지출 근거와 비용 추적을 관리합니다.','claude-sonnet-4-5',1,1,1,true),
('planning','기획','department','📋','운영 일정, 회의 안건, 과제 로드맵을 정리합니다.','claude-sonnet-4-5',2,2,1,true),
('external','대외협력','department','🤝','기관 협의, 공문, 협력 제안 흐름을 관리합니다.','claude-sonnet-4-5',3,3,1,true),
('development','개발','department','💻','권한, DB, 운영, 오류 대응, 비용과 로그를 관리합니다.','claude-sonnet-4-5',4,1,3,true),
('research','연구','department','🔬','교육과정 분석, 수업 연구, 자료 분석과 루브릭을 다룹니다.','claude-sonnet-4-5',5,2,3,true),
('promotion','홍보','department','📣','발표자료, 홍보 문안, 시각화 산출물을 만듭니다.','claude-sonnet-4-5',6,3,3,true),
('city_research','비활성 프로젝트방','project','🏫','향후 재사용을 위해 비활성화된 프로젝트 방입니다.','claude-sonnet-4-5',7,1,4,false),
('province_research','경기도교육연구회','project','🏢','경기도교육연구회 산출물과 협의 내용을 관리합니다.','claude-sonnet-4-5',8,2,4,true),
('science_museum','과학관 AI교육 연구회','project','🔭','과학관 AI교육 연구회 운영, 협력 과제, 전시/체험 자료를 정리합니다.','claude-sonnet-4-5',9,3,4,true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

INSERT INTO public.agents (id, room_id, name, role, default_model, system_prompt, guest_prompt, is_active)
SELECT room_id || '_bot', room_id, bot_name, room_name || ' 도메인 봇', 'claude-sonnet-4-5',
  room_name || ' 업무를 총괄한다. 개인정보와 민감정보를 무단 공유하지 않고, 자기 분야 밖의 결정을 단정하지 않는다.',
  '회의방에서는 비전문가도 이해할 수 있게 짧게 브리핑하고 출처와 다음 행동을 제안한다.',
  is_active
FROM (VALUES
('finance','재무','재무봇',true),
('planning','기획','기획봇',true),
('external','대외협력','대외협력봇',true),
('development','개발','개발봇',true),
('research','연구','연구봇',true),
('promotion','홍보','홍보봇',true),
('city_research','비활성 프로젝트방','예비봇',false),
('province_research','경기도교육연구회','도교육봇',true),
('science_museum','과학관 AI교육 연구회','과학관봇',true)
) AS seed(room_id, room_name, bot_name, is_active)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.domain_memory (room_id, summary)
SELECT id, name || ' 초기 요약 캐시입니다.'
FROM public.rooms
ON CONFLICT (room_id) DO NOTHING;

INSERT INTO public.room_memory_stores (room_id, anthropic_memory_store_id, purpose)
SELECT id, NULL, name || ' Claude Memory Store placeholder'
FROM public.rooms
ON CONFLICT DO NOTHING;
