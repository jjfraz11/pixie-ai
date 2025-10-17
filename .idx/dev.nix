# To learn more about how to use Nix to configure your environment
# see: https://firebase.google.com/docs/studio/customize-workspace
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-24.05"; # or "unstable"

  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.postgresql
  ];

  # Sets environment variables in the workspace
  env = {
    DATABASE_URL = "postgresql://@localhost:5432/pixieai";


  };
  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      # "vscodevim.vim"
    ];

    # Enable previews
    previews = {
      enable = true;
      previews = {
        # web = {
        #   # Example: run "npm run dev" with PORT set to IDX's defined port for previews,
        #   # and show it in IDX's web preview panel
        #   command = ["npm" "run" "dev"];
        #   manager = "web";
        #   env = {
        #     # Environment variables to set for your server
        #     PORT = "$PORT";
        #   };
        # };
      };
    };

    # Workspace lifecycle hooks
    workspace = {
      # Runs when a workspace is first created
      onCreate = {
        init-db = ''
          export PGDATA=$HOME/pgdata
          export PGHOST=$HOME/pgdata
          initdb -D $PGDATA --no-locale --encoding=UTF8
          echo "host all all 0.0.0.0/0 trust" >> $PGDATA/pg_hba.conf
          echo "listen_addresses = '*'" >> $PGDATA/postgresql.conf
        '';
      };
      # Runs when the workspace is (re)started
      onStart = {
        start-db = ''
          export PGDATA=$HOME/pgdata
          export PGHOST=$HOME/pgdata
          pg_ctl -D $PGDATA -l $HOME/postgres.log start
          createdb pixieai || true
        '';
      };
    };
  };
}
