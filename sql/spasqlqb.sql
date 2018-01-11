

create procedure YOUID.DBA.create_vdirs (
  in lPath varchar := '/spasqlqb',
  in vHost varchar := null,
  in lHost varchar := null)
{
  vHost := coalesce (vHost, '*ini*');
  lHost := coalesce (lHost, '*ini*');

  -- In case we are adding vdirs to an https listener we need the security options
  -- all vdirs should have the same security settings, thus, we can just grab the first one
  declare hpSec, hpAuthOpts any;
  hpSec := null;
  hpAuthOpts := null;
  for (select top 1 HP_SECURITY, deserialize(HP_AUTH_OPTIONS) as so from DB.DBA.HTTP_PATH where HP_HOST = vHost and HP_LISTEN_HOST = lHost and deserialize(HP_AUTH_OPTIONS) is not null) do
  {
    hpSec := HP_SECURITY;
    hpAuthOpts := so;
  }


  DB.DBA.VHOST_REMOVE (
    lhost => lHost,
    vhost => vHost,
    lpath => lPath
  );

  DB.DBA.VHOST_DEFINE (
    lhost    => lHost,
    vhost    => vHost,
    lpath    => lPath,
    ppath=>'/DAV/VAD/spasqlqb/www/',
    is_dav=>1,
    def_page=>'spasqlqb.vsp',
    vsp_user=>'dba',
    opts=>vector ('executable', 'yes', 'browse_sheet', ''),
    sec      => hpSec,
    auth_opts=> hpAuthOpts
  );


}
;

-- Create default vdirs
YOUID.DBA.create_vdirs ();
